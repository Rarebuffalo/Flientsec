import csv
import io
import uuid
import yaml
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core import security
from app.models import models
from app.schemas import schemas
from app.services import webhook_service, compliance_service, remediation_service

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


def dispatch_webhooks_for_event(db: Session, org_id: uuid.UUID, event_data: dict):
    try:
        webhooks = (
            db.query(models.Webhook)
            .filter(
                models.Webhook.organization_id == org_id,
                models.Webhook.enabled.is_(True),
            )
            .all()
        )
        if not webhooks:
            return

        evt_type = event_data.get("type")
        evt_id = event_data.get("id")
        payload = event_data.get("payload")

        for wh in webhooks:
            try:
                sub_events = (
                    json.loads(wh.events)
                    if isinstance(wh.events, str)
                    else wh.events
                )
            except Exception:
                sub_events = ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]
            if evt_type in sub_events:
                webhook_service.deliver_webhook_sync(
                    db=db,
                    webhook_id=wh.id,
                    event_id=evt_id,
                    event_type=evt_type,
                    payload_dict=payload,
                )
    except Exception:
        pass


def dispatch_webhooks_background_worker(org_id: uuid.UUID, event_data: dict):
    """
    Asynchronously delivers webhooks using an isolated database session,
    ensuring agent check-in and policy management requests are not blocked
    by slow, unhealthily responding, or timed-out external webhook receivers.
    """
    from app.core import database
    db = database.SessionLocal()
    try:
        dispatch_webhooks_for_event(db, org_id, event_data)
    except Exception:
        pass
    finally:
        db.close()


# Helper to fetch current user from JWT token
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    email = security.decode_access_token(token)
    if email is None:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


# Helper to fetch current user or device credentials
def get_current_user_or_device(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    device_uuid: Optional[str] = Header(None),
    x_device_token: Optional[str] = Header(None),
):
    if device_uuid and x_device_token:
        device = verify_device_token(device_uuid, x_device_token, db)
        return None, device.organization

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ")[1]
    email = security.decode_access_token(token)
    if email is None:
        raise HTTPException(
            status_code=401, detail="Could not validate credentials"
        )
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user, None


# Helper to retrieve default organization ID
def get_default_organization(db: Session) -> models.Organization:
    org = (
        db.query(models.Organization)
        .order_by(models.Organization.created_at.asc())
        .first()
    )
    if not org:
        org = models.Organization(name="FlientSec Default Corp")
        db.add(org)
        db.commit()
        db.refresh(org)
    return org


# Helper to guarantee default seeder is ready
def ensure_default_data(db: Session):
    org = get_default_organization(db)

    admin_email = "admin@flientsec.local"
    admin_user = (
        db.query(models.User).filter(models.User.email == admin_email).first()
    )
    if not admin_user:
        admin_user = models.User(
            email=admin_email,
            hashed_password=security.get_password_hash("flientsec_admin_pass"),
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        # Make Owner of default organization
        member = models.Member(
            user_id=admin_user.id, organization_id=org.id, role="owner"
        )
        db.add(member)
        db.commit()
    else:
        # Guarantee credentials and membership are synced
        admin_user.hashed_password = security.get_password_hash(
            "flientsec_admin_pass"
        )
        db.commit()

        member = (
            db.query(models.Member)
            .filter(
                models.Member.user_id == admin_user.id,
                models.Member.organization_id == org.id,
            )
            .first()
        )
        if not member:
            member = models.Member(
                user_id=admin_user.id, organization_id=org.id, role="owner"
            )
            db.add(member)
            db.commit()


# Helper to authorize agent telemetry calls using client device tokens
def verify_device_token(
    device_uuid: str, x_device_token: str, db: Session
) -> models.Device:
    try:
        dev_id = uuid.UUID(device_uuid)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    device = db.query(models.Device).filter(models.Device.id == dev_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Device not found"
        )

    if device.status == "DECOMMISSIONED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device has been decommissioned",
        )

    if not device.device_token or device.device_token != x_device_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device credentials",
        )

    return device


# Public Endpoints
@router.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@router.get("/version")
def version_check():
    return {"version": "1.0.0", "supported_agent_versions": ["1.0.0"]}


@router.post("/auth/login", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ensure_default_data(db)
    user = (
        db.query(models.User)
        .filter(models.User.email == form_data.username)
        .first()
    )
    if not user or not security.verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = security.create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}


# User & Organizations Setup APIs
@router.post("/auth/register")
def register_user(login_in: schemas.UserLogin, db: Session = Depends(get_db)):
    # Check if user already exists
    user = (
        db.query(models.User)
        .filter(models.User.email == login_in.email)
        .first()
    )
    if user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = models.User(
        email=login_in.email,
        hashed_password=security.get_password_hash(login_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default personal organization for user
    org = models.Organization(
        name=f"{login_in.email.split('@')[0]}'s Workspace"
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # Map user as Owner of new workspace
    member = models.Member(
        user_id=user.id, organization_id=org.id, role="owner"
    )
    db.add(member)
    db.commit()

    return {"status": "registered", "organization": org.name}


# Agent REST APIs
@router.post("/agent/register")
def register_device(
    device_in: schemas.DeviceRegister,
    enrollment_token: str = Header(...),
    db: Session = Depends(get_db),
):
    # Validate enrollment token or fallback to default org for MVP
    # compatibility
    org = None
    tok = None
    if (
        enrollment_token == "default_token"
        or enrollment_token == "flientsec_enroll_token_hash"
    ):
        org = get_default_organization(db)
    else:
        # Check active enrollment tokens inside db
        tok = (
            db.query(models.EnrollmentToken)
            .filter(models.EnrollmentToken.token_hash == enrollment_token)
            .first()
        )
        if tok:
            if tok.expires_at < datetime.utcnow():
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Enrollment token expired",
                )
            org = tok.organization

    if not org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid enrollment token",
        )

    # Check if device already registered
    device = (
        db.query(models.Device)
        .filter(models.Device.id == device_in.id)
        .first()
    )

    # Generate unique Device Token for this specific client
    dev_token = f"dev_tok_{uuid.uuid4().hex}"

    if not device:
        device = models.Device(
            id=device_in.id,
            organization_id=org.id,
            hostname=device_in.hostname,
            os_name=device_in.os_name,
            os_version=device_in.os_version,
            os_arch=device_in.os_arch,
            kernel_version=device_in.kernel_version,
            agent_version=device_in.agent_version,
            status="PENDING",
            compliance_status="UNKNOWN",
            compliance_score=100,
            device_token=dev_token,
            last_checkin=datetime.utcnow(),
        )
        db.add(device)
    else:
        # Re-register / reset token on reinstallations
        device.organization_id = org.id
        device.hostname = device_in.hostname
        device.os_name = device_in.os_name
        device.os_version = device_in.os_version
        device.os_arch = device_in.os_arch
        device.kernel_version = device_in.kernel_version
        device.agent_version = device_in.agent_version
        device.status = "ONLINE"
        device.device_token = dev_token
        device.last_checkin = datetime.utcnow()

    if tok:
        db.delete(tok)
    db.commit()
    db.refresh(device)
    return {"status": "enrolled", "device_token": device.device_token}


@router.post("/agent/heartbeat")
def agent_heartbeat(
    device_uuid: str = Header(...),
    x_device_token: str = Header(...),
    db: Session = Depends(get_db),
):
    device = verify_device_token(device_uuid, x_device_token, db)
    device.status = "ONLINE"
    device.last_checkin = datetime.utcnow()
    db.commit()
    return {"status": "ok"}


@router.post("/agent/checkin", response_model=schemas.CheckRunResponse)
def agent_checkin(
    checkrun_in: schemas.CheckRunCreate,
    background_tasks: BackgroundTasks,
    device_uuid: str = Header(...),
    x_device_token: str = Header(...),
    db: Session = Depends(get_db),
):
    device = verify_device_token(device_uuid, x_device_token, db)
    events_to_dispatch = []

    # 1. Idempotency Check
    existing_run = (
        db.query(models.CheckRun)
        .filter(models.CheckRun.id == checkrun_in.id)
        .first()
    )
    if existing_run:
        # Scope validation: verify it belongs to the authenticated device
        if existing_run.device_id != device.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested checkrun record."
            )
        return existing_run

    # 2. Acquire exclusive write-lock on Device to serialize telemetry
    device = (
        db.query(models.Device)
        .filter(models.Device.id == device.id)
        .with_for_update()
        .first()
    )

    # 3. Provenance Validation
    prov_status = None
    if (checkrun_in.policy_version_id is None or
            checkrun_in.content_hash is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required policy version or content hash provenance"
        )
    else:
        # Query PolicyVersion
        version = (
            db.query(models.PolicyVersion)
            .filter(
                models.PolicyVersion.id == checkrun_in.policy_version_id
            )
            .first()
        )
        if not version or version.status != "PUBLISHED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid policy version: not found or not published"
            )

        # Check tenant isolation
        if (not version.policy or
                version.policy.organization_id != device.organization_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unauthorized policy version access: tenant mismatch"
            )

        # Hash integrity check
        clean_submitted = checkrun_in.content_hash.replace("sha256:", "")
        clean_stored = (version.content_hash or "").replace("sha256:", "")
        if clean_submitted != clean_stored:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integrity check failed: content hash mismatch"
            )

        # Determine currently desired effective policy version
        assignment = (
            db.query(models.PolicyAssignment)
            .filter(models.PolicyAssignment.device_id == device.id)
            .first()
        )
        if not assignment:
            assignment = (
                db.query(models.PolicyAssignment)
                .filter(
                    models.PolicyAssignment.organization_id == (
                        device.organization_id
                    ),
                    models.PolicyAssignment.device_id.is_(None)
                )
                .first()
            )

        desired_ver_id = None
        if assignment and assignment.policy:
            desired_ver_id = assignment.policy.active_version_id

        # Classify status
        if desired_ver_id and version.id == desired_ver_id:
            prov_status = "CURRENT"
        else:
            prov_status = "OUTDATED_POLICY"

    # Save CheckRun log
    check_run = models.CheckRun(
        id=checkrun_in.id,
        device_id=device.id,
        timestamp=checkrun_in.timestamp,
        status=checkrun_in.status,
        score=checkrun_in.score,
        policy_version_id=checkrun_in.policy_version_id,
        content_hash=checkrun_in.content_hash,
        provenance_status=prov_status,
    )
    db.add(check_run)

    # 4. State Machine / Findings Updates: CURRENT only
    if prov_status == "CURRENT":
        # Generate immutable audit Evidence records for all evaluated policy rules
        try:
            compliance_service.generate_evidence_for_checkin(
                db=db,
                device=device,
                check_run=check_run,
                policy_version=version,
                reported_findings=checkrun_in.findings,
            )
        except Exception:
            pass

        # Extract evaluated rules from the policy version JSON/YAML
        import json as py_json
        evaluated_rules = {}
        try:
            policy_data = py_json.loads(version.definition_json)
            if isinstance(policy_data, dict):
                if "checks" in policy_data and isinstance(policy_data["checks"], dict):
                    for k, v in policy_data["checks"].items():
                        evaluated_rules[k] = v if isinstance(v, dict) else {"id": k}
                if "rules" in policy_data and isinstance(policy_data["rules"], list):
                    for r in policy_data["rules"]:
                        if isinstance(r, dict) and r.get("id"):
                            evaluated_rules[r.get("id")] = r
        except Exception:
            evaluated_rules = {}

        # Process reported failures
        new_failed_rules = set()
        for f_in in checkrun_in.findings:
            if f_in.status.upper() not in ["FAIL", "FAILED"]:
                continue
            rule_id = f_in.rule_id
            new_failed_rules.add(rule_id)

            # Query existing active non-resolved finding
            finding = (
                db.query(models.Finding)
                .filter(
                    models.Finding.device_id == device.id,
                    models.Finding.policy_id == version.policy_id,
                    models.Finding.rule_id == rule_id,
                    models.Finding.status != "RESOLVED",
                )
                .first()
            )

            if finding:
                # Check for waiver expiry on re-check
                if (
                    finding.status == "WAIVED"
                    and finding.waiver_expires_at
                    and finding.waiver_expires_at <= datetime.utcnow()
                ):
                    finding.status = "OPEN"
                    event_id = uuid.uuid4()
                    exp_event = models.Event(
                        id=event_id,
                        device_id=device.id,
                        type="FINDING_WAIVER_EXPIRED",
                        rule_name=rule_id,
                        message=f"Waiver expired for rule {rule_id}. Finding reactivated as OPEN.",
                        timestamp=datetime.utcnow(),
                        finding_id=finding.id,
                        policy_version_id=version.id
                    )
                    db.add(exp_event)
                    events_to_dispatch.append({
                        "id": event_id,
                        "type": "FINDING_WAIVER_EXPIRED",
                        "payload": {
                            "id": str(event_id),
                            "type": "FINDING_WAIVER_EXPIRED",
                            "version": "1",
                            "timestamp": exp_event.timestamp.isoformat(),
                            "organization_id": str(device.organization_id),
                            "device": {
                                "id": str(device.id),
                                "hostname": device.hostname,
                                "os_name": device.os_name,
                                "os_version": device.os_version,
                            },
                            "finding": {
                                "id": str(finding.id),
                                "rule_id": rule_id,
                                "severity": finding.severity,
                                "status": "OPEN",
                                "reason": f_in.reason,
                            }
                        }
                    })

                finding.last_detected_at = datetime.utcnow()
                finding.reason = f_in.reason
            else:
                # Classify drift type
                drift_type = None

                # Find previous run before current run timestamp
                prev_run = (
                    db.query(models.CheckRun)
                    .filter(
                        models.CheckRun.device_id == device.id,
                        models.CheckRun.timestamp < checkrun_in.timestamp
                    )
                    .order_by(models.CheckRun.timestamp.desc())
                    .first()
                )

                if prev_run:
                    if prev_run.policy_version_id == version.id:
                        drift_type = "DEVICE_DRIFT"
                    else:
                        # Fetch and parse previous policy version
                        prev_ver = (
                            db.query(models.PolicyVersion)
                            .filter(
                                models.PolicyVersion.id == (
                                    prev_run.policy_version_id
                                )
                            )
                            .first()
                        )
                        prev_rules = {}
                        if prev_ver:
                            try:
                                prev_policy_data = py_json.loads(
                                    prev_ver.definition_json
                                )
                                for r in prev_policy_data.get("rules", []):
                                    if r.get("id"):
                                        prev_rules[r.get("id")] = r
                            except Exception:
                                pass

                        old_rule = prev_rules.get(rule_id)
                        new_rule = evaluated_rules.get(rule_id)

                        if not old_rule:
                            # Rule did not exist in old version
                            drift_type = "POLICY_CHANGE_NON_COMPLIANCE"
                        else:
                            # Compare enforcement fields
                            is_diff = False
                            for key in ["check", "operator", "expected"]:
                                if old_rule.get(key) != new_rule.get(key):
                                    is_diff = True
                                    break
                            if is_diff:
                                drift_type = "POLICY_CHANGE_NON_COMPLIANCE"
                            else:
                                drift_type = "DEVICE_DRIFT"
                else:
                    drift_type = None

                finding = models.Finding(
                    id=uuid.uuid4(),
                    device_id=device.id,
                    policy_id=version.policy_id,
                    rule_id=rule_id,
                    check_name=f_in.check_name,
                    severity=f_in.severity,
                    status="OPEN",
                    reason=f_in.reason,
                    drift_type=drift_type,
                    first_detected_at=datetime.utcnow(),
                    last_detected_at=datetime.utcnow(),
                )
                db.add(finding)
                db.flush()  # Populates finding.id for event ForeignKey

                event_id = uuid.uuid4()
                # Trigger Event
                event = models.Event(
                    id=event_id,
                    device_id=device.id,
                    type="VIOLATION_TRIGGERED",
                    rule_name=rule_id,
                    message=f"Violation triggered: Rule {rule_id} failed.",
                    timestamp=datetime.utcnow(),
                    finding_id=finding.id,
                    policy_version_id=version.id
                )
                db.add(event)
                events_to_dispatch.append({
                    "id": event_id,
                    "type": "VIOLATION_TRIGGERED",
                    "payload": {
                        "id": str(event_id),
                        "type": "VIOLATION_TRIGGERED",
                        "version": "1",
                        "timestamp": event.timestamp.isoformat(),
                        "organization_id": str(device.organization_id),
                        "device": {
                            "id": str(device.id),
                            "hostname": device.hostname,
                            "os_name": device.os_name,
                            "os_version": device.os_version,
                        },
                        "finding": {
                            "id": str(finding.id),
                            "rule_id": rule_id,
                            "severity": f_in.severity,
                            "status": "OPEN",
                            "reason": f_in.reason,
                        }
                    }
                })

        # Process resolved and removed rules across all active non-resolved findings
        active_findings = (
            db.query(models.Finding)
            .filter(
                models.Finding.device_id == device.id,
                models.Finding.policy_id == version.policy_id,
                models.Finding.status != "RESOLVED",
            )
            .all()
        )

        for f in active_findings:
            rule_id = f.rule_id
            if rule_id not in new_failed_rules:
                event_id = uuid.uuid4()
                # Determine if rule was evaluated or removed
                if rule_id in evaluated_rules:
                    # Evaluated but did not fail -> REMEDIATED
                    f.status = "RESOLVED"
                    f.resolved_at = datetime.utcnow()
                    f.resolution_reason = "REMEDIATED"

                    event = models.Event(
                        id=event_id,
                        device_id=device.id,
                        type="VIOLATION_RESOLVED",
                        rule_name=rule_id,
                        message=(
                            f"Violation resolved: Rule {rule_id} is "
                            "now compliant."
                        ),
                        timestamp=datetime.utcnow(),
                        finding_id=f.id,
                        policy_version_id=version.id
                    )
                    db.add(event)
                else:
                    # Not present in desired version -> POLICY_RULE_REMOVED
                    f.status = "RESOLVED"
                    f.resolved_at = datetime.utcnow()
                    f.resolution_reason = "POLICY_RULE_REMOVED"

                    event = models.Event(
                        id=event_id,
                        device_id=device.id,
                        type="VIOLATION_RESOLVED",
                        rule_name=rule_id,
                        message=(
                            f"Violation resolved: Rule {rule_id} was "
                            "removed from the policy."
                        ),
                        timestamp=datetime.utcnow(),
                        finding_id=f.id,
                        policy_version_id=version.id
                    )
                    db.add(event)

                events_to_dispatch.append({
                    "id": event_id,
                    "type": "VIOLATION_RESOLVED",
                    "payload": {
                        "id": str(event_id),
                        "type": "VIOLATION_RESOLVED",
                        "version": "1",
                        "timestamp": event.timestamp.isoformat(),
                        "organization_id": str(device.organization_id),
                        "device": {
                            "id": str(device.id),
                            "hostname": device.hostname,
                            "os_name": device.os_name,
                            "os_version": device.os_version,
                        },
                        "finding": {
                            "id": str(f.id),
                            "rule_id": rule_id,
                            "severity": f.severity,
                            "status": "RESOLVED",
                            "reason": f.resolution_reason,
                        }
                    }
                })

    # 5. Update Device stats
    device.status = "ONLINE"
    device.compliance_status = checkrun_in.status
    device.compliance_score = checkrun_in.score
    device.last_checkin = datetime.utcnow()

    db.commit()
    db.refresh(check_run)

    # Dispatch webhooks asynchronously after transaction commits safely
    for evt_info in events_to_dispatch:
        if background_tasks:
            background_tasks.add_task(
                dispatch_webhooks_background_worker, device.organization_id, evt_info
            )
        else:
            dispatch_webhooks_background_worker(device.organization_id, evt_info)

    return check_run


# Enrollment Token APIs (Requires auth)
@router.get(
    "/enrollment-tokens", response_model=List[schemas.EnrollmentTokenResponse]
)
def list_enrollment_tokens(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    return (
        db.query(models.EnrollmentToken)
        .filter(models.EnrollmentToken.organization_id.in_(memberships))
        .all()
    )


@router.post(
    "/enrollment-tokens", response_model=schemas.EnrollmentTokenResponse
)
def create_enrollment_token(
    token_in: schemas.EnrollmentTokenCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.memberships:
        raise HTTPException(
            status_code=400, detail="User is not part of any organization"
        )
    org_id = current_user.memberships[0].organization_id

    # Generate a secure token string
    token_val = f"flientsec_enroll_{uuid.uuid4().hex}"
    tok = models.EnrollmentToken(
        id=uuid.uuid4(),
        organization_id=org_id,
        token_hash=token_val,
        created_by=current_user.id,
        expires_at=token_in.expires_at,
        created_at=datetime.utcnow(),
    )
    db.add(tok)
    db.commit()
    db.refresh(tok)
    return tok


@router.post(
    "/enrollment-tokens/{id}/revoke",
    response_model=schemas.EnrollmentTokenResponse,
)
def revoke_enrollment_token(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    tok = (
        db.query(models.EnrollmentToken)
        .filter(
            models.EnrollmentToken.id == id,
            models.EnrollmentToken.organization_id.in_(memberships),
        )
        .first()
    )
    if not tok:
        raise HTTPException(status_code=404, detail="Token not found")

    db.delete(tok)
    db.commit()
    return tok


# Dashboard APIs (Requires auth)
@router.get("/devices", response_model=List[schemas.DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Find matching organizations memberships
    memberships = [m.organization_id for m in current_user.memberships]

    # Evaluate stale devices (> 2 minutes without check-in becomes OFFLINE)
    timeout_threshold = datetime.utcnow() - timedelta(minutes=2)
    stale_devices = (
        db.query(models.Device)
        .filter(
            models.Device.organization_id.in_(memberships),
            models.Device.status == "ONLINE",
            models.Device.last_checkin < timeout_threshold,
        )
        .all()
    )
    for dev in stale_devices:
        dev.status = "OFFLINE"
    if stale_devices:
        db.commit()

    return (
        db.query(models.Device)
        .filter(
            models.Device.organization_id.in_(memberships),
            models.Device.status != "DECOMMISSIONED",
        )
        .all()
    )


def evaluate_device_liveness(
    device: models.Device, db: Session
) -> models.Device:
    if device.status == "ONLINE" and device.last_checkin:
        timeout_threshold = datetime.utcnow() - timedelta(minutes=2)
        if device.last_checkin < timeout_threshold:
            device.status = "OFFLINE"
            db.commit()
            db.refresh(device)
    return device


@router.get("/devices/{id}", response_model=schemas.DeviceResponse)
def get_device(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return evaluate_device_liveness(device, db)


@router.post("/devices/{id}/revoke", response_model=schemas.DeviceResponse)
@router.post("/devices/{id}/decommission", response_model=schemas.DeviceResponse)
def decommission_device(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.status = "DECOMMISSIONED"
    db.commit()
    db.refresh(device)
    return device


@router.get(
    "/devices/{id}/latest-run",
    response_model=Optional[schemas.CheckRunResponse],
)
def get_device_latest_run(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    run = (
        db.query(models.CheckRun)
        .filter(models.CheckRun.device_id == id)
        .order_by(models.CheckRun.timestamp.desc())
        .first()
    )
    if not run:
        return None

    open_findings = (
        db.query(models.Finding)
        .filter(
            models.Finding.device_id == id,
            models.Finding.status == "OPEN"
        )
        .all()
    )

    findings_list = []
    for f in open_findings:
        findings_list.append(
            schemas.DeviceFindingResponse(
                id=f.id,
                rule_name=f.check_name,
                severity=f.severity,
                status="FAIL" if f.severity == "HIGH" else "WARN",
                message=f.reason or "",
            )
        )

    policy_name = None
    version_number = None
    if run.policy_version_id:
        version = (
            db.query(models.PolicyVersion)
            .filter(models.PolicyVersion.id == run.policy_version_id)
            .first()
        )
        if version:
            version_number = version.version_number
            policy = (
                db.query(models.Policy)
                .filter(models.Policy.id == version.policy_id)
                .first()
            )
            if policy:
                policy_name = policy.name

    return schemas.CheckRunResponse(
        id=run.id,
        device_id=run.device_id,
        timestamp=run.timestamp,
        status=run.status,
        score=run.score,
        findings=findings_list,
        policy_version_id=run.policy_version_id,
        content_hash=run.content_hash,
        provenance_status=run.provenance_status,
        policy_name=policy_name,
        version_number=version_number,
    )


@router.get(
    "/devices/{id}/history", response_model=List[schemas.EventResponse]
)
def get_device_history(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return (
        db.query(models.Event)
        .filter(models.Event.device_id == id)
        .order_by(models.Event.timestamp.desc())
        .all()
    )


@router.get(
    "/devices/{id}/findings", response_model=List[schemas.FindingResponse]
)
def get_device_findings(
    id: uuid.UUID,
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    query = db.query(models.Finding).filter(models.Finding.device_id == id)
    if status is not None:
        if status.upper() == "ACTIVE":
            query = query.filter(models.Finding.status != "RESOLVED")
        else:
            query = query.filter(models.Finding.status == status)

    return (
        query.order_by(models.Finding.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get(
    "/devices/{id}/check-runs", response_model=List[schemas.CheckRunResponse]
)
def get_device_check_runs(
    id: uuid.UUID,
    limit: int = Query(20, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    runs = (
        db.query(models.CheckRun)
        .filter(models.CheckRun.device_id == id)
        .order_by(models.CheckRun.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    response_runs = []
    for r in runs:
        policy_name = None
        version_number = None
        if r.policy_version_id:
            version = (
                db.query(models.PolicyVersion)
                .filter(models.PolicyVersion.id == r.policy_version_id)
                .first()
            )
            if version:
                version_number = version.version_number
                policy = (
                    db.query(models.Policy)
                    .filter(models.Policy.id == version.policy_id)
                    .first()
                )
                if policy:
                    policy_name = policy.name

        response_runs.append(
            schemas.CheckRunResponse(
                id=r.id,
                device_id=r.device_id,
                timestamp=r.timestamp,
                status=r.status,
                score=r.score,
                findings=[],
                policy_version_id=r.policy_version_id,
                content_hash=r.content_hash,
                provenance_status=r.provenance_status,
                policy_name=policy_name,
                version_number=version_number,
            )
        )
    return response_runs


def seed_default_policy(db: Session, admin_user: models.User) -> models.Policy:
    org = None
    if admin_user.memberships:
        org_id = admin_user.memberships[0].organization_id
        org = (
            db.query(models.Organization)
            .filter(models.Organization.id == org_id)
            .first()
        )
    if not org:
        org = get_default_organization(db)

    policy = (
        db.query(models.Policy)
        .filter(models.Policy.organization_id == org.id)
        .first()
    )
    if not policy:
        policy = models.Policy(
            organization_id=org.id,
            name=f"{org.name} Baseline Policy",
            description="Default workstation configuration checks definition.",
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)

        # Seed Policy Version 1
        default_rules = {
            "checks": {
                "firewall": {
                    "enabled": True,
                    "required": True,
                    "severity": "HIGH",
                },
                "encryption": {
                    "enabled": True,
                    "required": True,
                    "severity": "HIGH",
                },
                "ssh": {
                    "enabled": True,
                    "required": False,
                    "severity": "MEDIUM",
                },
                "updates": {
                    "enabled": True,
                    "required": True,
                    "severity": "MEDIUM",
                },
                "runtime": {
                    "enabled": True,
                    "required": True,
                    "severity": "MEDIUM",
                },
            }
        }
        def_json = json.dumps(default_rules)
        c_hash = hashlib.sha256(def_json.encode('utf-8')).hexdigest()
        ver = models.PolicyVersion(
            policy_id=policy.id,
            version_number=1,
            definition_json=def_json,
            content=def_json,
            content_hash=c_hash,
            status="PUBLISHED",
            created_by=admin_user.id,
        )
        db.add(ver)
        db.commit()
        db.refresh(ver)
        policy.active_version_id = ver.id
        db.commit()
        db.refresh(policy)
    return policy


@router.get("/policies", response_model=schemas.PolicyResponse)
def get_policies(
    db: Session = Depends(get_db),
    auth_result=Depends(get_current_user_or_device),
):
    # Returns first policy or generates default organizational workspace
    # mapping
    current_user, org = auth_result
    if current_user:
        if current_user.memberships:
            org_id = current_user.memberships[0].organization_id
            org = (
                db.query(models.Organization)
                .filter(models.Organization.id == org_id)
                .first()
            )
        if not org:
            org = get_default_organization(db)

    policy = (
        db.query(models.Policy)
        .filter(models.Policy.organization_id == org.id)
        .first()
    )
    if not policy:
        admin_user = (
            db.query(models.User)
            .filter(models.User.email == "admin@flientsec.local")
            .first()
        )
        policy = seed_default_policy(db, current_user or admin_user)

    # Get latest version definition and serialize to YAML
    latest_version = (
        db.query(models.PolicyVersion)
        .filter(models.PolicyVersion.policy_id == policy.id)
        .order_by(models.PolicyVersion.version_number.desc())
        .first()
    )
    if latest_version:
        try:
            rules_dict = json.loads(latest_version.definition_json)
            policy.rules_yaml = yaml.dump(rules_dict, default_flow_style=False)
        except Exception:
            policy.rules_yaml = ""
    # Resolve active version number
    active_version_number = None
    if policy.active_version_id:
        active_ver = (
            db.query(models.PolicyVersion)
            .filter(models.PolicyVersion.id == policy.active_version_id)
            .first()
        )
        if active_ver:
            active_version_number = active_ver.version_number
    policy.active_version_number = active_version_number

    return policy


@router.post("/policies", response_model=schemas.PolicyResponse)
def update_policy(
    policy_in: schemas.PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    org = None
    if current_user.memberships:
        org_id = current_user.memberships[0].organization_id
        org = (
            db.query(models.Organization)
            .filter(models.Organization.id == org_id)
            .first()
        )
    if not org:
        org = get_default_organization(db)

    policy = (
        db.query(models.Policy)
        .filter(models.Policy.organization_id == org.id)
        .first()
    )
    if not policy:
        policy = seed_default_policy(db, current_user)

    # Validate YAML correctness
    try:
        rules_dict = yaml.safe_load(policy_in.rules_yaml)
        if not isinstance(rules_dict, dict) or "checks" not in rules_dict:
            raise HTTPException(
                status_code=400,
                detail="Policy must define a 'checks' root object",
            )
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid YAML configuration: {str(e)}"
        )

    last_ver = (
        db.query(models.PolicyVersion)
        .filter(models.PolicyVersion.policy_id == policy.id)
        .order_by(models.PolicyVersion.version_number.desc())
        .first()
    )
    next_num = (last_ver.version_number + 1) if last_ver else 1

    new_ver = models.PolicyVersion(
        policy_id=policy.id,
        version_number=next_num,
        definition_json=json.dumps(rules_dict),
        content=policy_in.rules_yaml,
        created_by=current_user.id,
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)

    policy.rules_yaml = policy_in.rules_yaml
    return policy


@router.get(
    "/policies/{id}/versions",
    response_model=List[schemas.PolicyVersionResponse],
)
def list_policy_versions(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return (
        db.query(models.PolicyVersion)
        .filter(models.PolicyVersion.policy_id == id)
        .order_by(models.PolicyVersion.version_number.desc())
        .all()
    )


@router.post(
    "/policies/{id}/versions", response_model=schemas.PolicyVersionResponse
)
def create_policy_version(
    id: uuid.UUID,
    rules_json: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    # Check JSON correctness
    try:
        json.loads(rules_json)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid JSON specification: {str(e)}"
        )

    last_ver = (
        db.query(models.PolicyVersion)
        .filter(models.PolicyVersion.policy_id == id)
        .order_by(models.PolicyVersion.version_number.desc())
        .first()
    )
    next_num = (last_ver.version_number + 1) if last_ver else 1

    new_ver = models.PolicyVersion(
        policy_id=id,
        version_number=next_num,
        definition_json=rules_json,
        content=rules_json,
        created_by=current_user.id,
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)
    return new_ver


@router.post(
    "/policies/{policy_id}/versions/{version_id}/publish",
    response_model=schemas.PolicyVersionResponse
)
def publish_policy_version(
    policy_id: uuid.UUID,
    version_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == policy_id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    version = (
        db.query(models.PolicyVersion)
        .filter(
            models.PolicyVersion.id == version_id,
            models.PolicyVersion.policy_id == policy_id,
        )
        .first()
    )
    if not version:
        raise HTTPException(
            status_code=404, detail="Policy version not found"
        )

    if version.status == "PUBLISHED":
        raise HTTPException(
            status_code=400, detail="Policy version is already published"
        )

    version.status = "PUBLISHED"
    # Ensure content is set
    if not version.content:
        version.content = version.definition_json
    # Compute content hash
    version.content_hash = hashlib.sha256(
        version.content.encode('utf-8')
    ).hexdigest()

    db.commit()
    db.refresh(version)
    return version


@router.post(
    "/policies/{policy_id}/activate", response_model=schemas.PolicyResponse
)
def activate_policy_version(
    policy_id: uuid.UUID,
    version_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == policy_id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    version = (
        db.query(models.PolicyVersion)
        .filter(
            models.PolicyVersion.id == version_id
        )
        .first()
    )
    if not version:
        raise HTTPException(
            status_code=404, detail="Policy version not found"
        )

    # Invariants verification:
    # 1. Must belong to the same Policy
    if version.policy_id != policy.id:
        raise HTTPException(
            status_code=400,
            detail="Policy version does not belong to this policy"
        )

    # 2. Must be PUBLISHED
    if version.status != "PUBLISHED":
        raise HTTPException(
            status_code=400,
            detail="Cannot activate a draft policy version"
        )

    policy.active_version_id = version.id
    db.commit()
    db.refresh(policy)

    # Populate rules_yaml dynamically for backward compatibility
    # / schema requirements
    try:
        rules_dict = json.loads(version.definition_json)
        policy.rules_yaml = yaml.dump(rules_dict, default_flow_style=False)
    except Exception:
        policy.rules_yaml = ""

    policy.active_version_number = version.version_number
    return policy


@router.post(
    "/policies/{policy_id}/rollback",
    response_model=schemas.PolicyRollbackResponse,
)
def rollback_policy_version(
    policy_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    target_version_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == policy_id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    target_version = (
        db.query(models.PolicyVersion)
        .filter(models.PolicyVersion.id == target_version_id)
        .first()
    )
    if not target_version:
        raise HTTPException(
            status_code=404, detail="Target policy version not found"
        )

    # Invariants validation:
    # 1. Target version belongs to this policy
    if target_version.policy_id != policy.id:
        raise HTTPException(
            status_code=400,
            detail="Target version does not belong to this policy",
        )

    # 2. Target version must be PUBLISHED (cannot rollback to DRAFT)
    if target_version.status != "PUBLISHED":
        raise HTTPException(
            status_code=400,
            detail="Cannot rollback to a draft policy version",
        )

    # 3. Target version cannot already be the active version
    if policy.active_version_id == target_version.id:
        raise HTTPException(
            status_code=400,
            detail="Target version is already the active version",
        )

    # 4. Validate JSON definition
    try:
        rules_dict = json.loads(target_version.definition_json)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Target version definition is corrupt or invalid JSON",
        )

    prev_version_id = policy.active_version_id
    prev_version = (
        db.query(models.PolicyVersion)
        .filter(models.PolicyVersion.id == prev_version_id)
        .first()
        if prev_version_id
        else None
    )
    prev_version_number = prev_version.version_number if prev_version else None

    # Update active version reference (Zero historical content mutation)
    policy.active_version_id = target_version.id
    policy.rules_yaml = yaml.dump(rules_dict, default_flow_style=False)

    # Create Audit Event
    event_id = uuid.uuid4()
    audit_event = models.Event(
        id=event_id,
        device_id=None,
        type="POLICY_ROLLBACK",
        rule_name="policy.active_version",
        message=(
            f"Policy '{policy.name}' rolled back from version "
            f"{prev_version_number or 'None'} to version "
            f"{target_version.version_number} by {current_user.email}."
        ),
        timestamp=datetime.utcnow(),
        finding_id=None,
        policy_version_id=target_version.id,
    )
    db.add(audit_event)
    db.commit()

    # Webhook dispatch for POLICY_ROLLBACK asynchronously via BackgroundTasks
    rollback_payload = {
        "id": str(event_id),
        "type": "POLICY_ROLLBACK",
        "version": "1",
        "timestamp": datetime.utcnow().isoformat(),
        "organization_id": str(policy.organization_id),
        "policy": {
            "id": str(policy.id),
            "name": policy.name,
            "previous_version_number": prev_version_number,
            "active_version_number": target_version.version_number,
        },
        "actor": {
            "id": str(current_user.id),
            "email": current_user.email,
        },
    }
    if background_tasks:
        background_tasks.add_task(
            dispatch_webhooks_background_worker,
            policy.organization_id,
            {
                "id": event_id,
                "type": "POLICY_ROLLBACK",
                "payload": rollback_payload,
            },
        )
    else:
        dispatch_webhooks_background_worker(
            policy.organization_id,
            {
                "id": event_id,
                "type": "POLICY_ROLLBACK",
                "payload": rollback_payload,
            },
        )

    return schemas.PolicyRollbackResponse(
        status="success",
        policy_id=policy.id,
        previous_active_version_id=prev_version_id,
        active_version_id=target_version.id,
        active_version_number=target_version.version_number,
        message=(
            f"Successfully rolled back policy '{policy.name}' to "
            f"version v{target_version.version_number}."
        ),
    )


@router.post(
    "/policies/{policy_id}/assign-default",
    response_model=schemas.PolicyAssignmentResponse,
)
def assign_default_policy(
    policy_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == policy_id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(
            status_code=404, detail="Policy not found"
        )

    # Check if a default assignment already exists
    assignment = (
        db.query(models.PolicyAssignment)
        .filter(
            models.PolicyAssignment.organization_id == (
                policy.organization_id
            ),
            models.PolicyAssignment.device_id.is_(None)
        )
        .first()
    )

    if assignment:
        assignment.policy_id = policy.id
    else:
        assignment = models.PolicyAssignment(
            id=uuid.uuid4(),
            organization_id=policy.organization_id,
            policy_id=policy.id,
            device_id=None
        )
        db.add(assignment)

    # Control-plane finding resolution for all devices impacted by this change
    impacted_devices = (
        db.query(models.Device)
        .filter(
            models.Device.organization_id == policy.organization_id,
            ~models.Device.id.in_(
                db.query(models.PolicyAssignment.device_id)
                .filter(
                    models.PolicyAssignment.organization_id == (
                        policy.organization_id
                    ),
                    models.PolicyAssignment.device_id.is_not(None)
                )
            )
        )
        .all()
    )
    for dev in impacted_devices:
        old_findings = (
            db.query(models.Finding)
            .filter(
                models.Finding.device_id == dev.id,
                models.Finding.policy_id != policy.id,
                models.Finding.status == "OPEN"
            )
            .all()
        )
        for f in old_findings:
            f.status = "RESOLVED"
            f.resolved_at = datetime.utcnow()
            f.resolution_reason = "POLICY_REASSIGNED"
            event = models.Event(
                device_id=dev.id,
                type="VIOLATION_RESOLVED",
                rule_name=f.rule_id,
                message=(
                    f"Violation resolved: Rule {f.rule_id} is part of a "
                    "previous policy that was reassigned."
                ),
                timestamp=datetime.utcnow(),
                finding_id=f.id
            )
            db.add(event)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.post(
    "/policies/{policy_id}/assign-device/{device_id}",
    response_model=schemas.PolicyAssignmentResponse,
)
def assign_device_policy(
    policy_id: uuid.UUID,
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.id == policy_id,
            models.Policy.organization_id.in_(memberships),
        )
        .first()
    )
    if not policy:
        raise HTTPException(
            status_code=404, detail="Policy not found"
        )

    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == device_id,
            models.Device.organization_id == policy.organization_id,
        )
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=404, detail="Device not found"
        )

    # Check if a device assignment already exists
    assignment = (
        db.query(models.PolicyAssignment)
        .filter(
            models.PolicyAssignment.device_id == device.id
        )
        .first()
    )

    if assignment:
        assignment.policy_id = policy.id
    else:
        assignment = models.PolicyAssignment(
            id=uuid.uuid4(),
            organization_id=policy.organization_id,
            policy_id=policy.id,
            device_id=device.id
        )
        db.add(assignment)

    # Control-plane finding resolution for this specific device
    old_findings = (
        db.query(models.Finding)
        .filter(
            models.Finding.device_id == device.id,
            models.Finding.policy_id != policy.id,
            models.Finding.status == "OPEN"
        )
        .all()
    )
    for f in old_findings:
        f.status = "RESOLVED"
        f.resolved_at = datetime.utcnow()
        f.resolution_reason = "POLICY_REASSIGNED"
        event = models.Event(
            device_id=device.id,
            type="VIOLATION_RESOLVED",
            rule_name=f.rule_id,
            message=(
                f"Violation resolved: Rule {f.rule_id} is part of a "
                "previous policy that was reassigned."
            ),
            timestamp=datetime.utcnow(),
            finding_id=f.id
        )
        db.add(event)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.get(
    "/devices/{device_id}/effective-policy",
    response_model=schemas.PolicyResponse,
)
def get_effective_policy(
    device_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == device_id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=404, detail="Device not found"
        )

    # Resolve active policy:
    # 1. Look for device override
    assignment = (
        db.query(models.PolicyAssignment)
        .filter(
            models.PolicyAssignment.device_id == device.id
        )
        .first()
    )

    # 2. Look for organization default
    if not assignment:
        assignment = (
            db.query(models.PolicyAssignment)
            .filter(
                models.PolicyAssignment.organization_id == (
                    device.organization_id
                ),
                models.PolicyAssignment.device_id.is_(None)
            )
            .first()
        )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="No policy assigned to this device or organization"
        )

    policy = (
        db.query(models.Policy)
        .filter(models.Policy.id == assignment.policy_id)
        .first()
    )
    if not policy:
        raise HTTPException(
            status_code=404, detail="Assigned policy not found"
        )

    # Populate rules_yaml dynamically for backward compatibility
    active_version_number = None
    if policy.active_version_id:
        version = (
            db.query(models.PolicyVersion)
            .filter(models.PolicyVersion.id == policy.active_version_id)
            .first()
        )
        if version:
            active_version_number = version.version_number
            if version.definition_json:
                try:
                    rules_dict = json.loads(version.definition_json)
                    policy.rules_yaml = yaml.dump(
                        rules_dict, default_flow_style=False
                    )
                except Exception:
                    policy.rules_yaml = ""
            else:
                policy.rules_yaml = ""
        else:
            policy.rules_yaml = ""
    else:
        policy.rules_yaml = ""

    policy.active_version_number = active_version_number
    return policy


def get_current_device(
    device_uuid: str = Header(..., alias="Device-Uuid"),
    x_device_token: str = Header(..., alias="X-Device-Token"),
    db: Session = Depends(get_db),
) -> models.Device:
    return verify_device_token(device_uuid, x_device_token, db)


@router.get(
    "/agent/policy",
    response_model=schemas.AgentPolicyResponse,
)
def get_agent_policy(
    db: Session = Depends(get_db),
    device: models.Device = Depends(get_current_device),
):
    # Resolve active policy:
    # 1. Device override
    assignment = (
        db.query(models.PolicyAssignment)
        .filter(
            models.PolicyAssignment.device_id == device.id
        )
        .first()
    )

    # 2. Organization default fallback
    if not assignment:
        assignment = (
            db.query(models.PolicyAssignment)
            .filter(
                models.PolicyAssignment.organization_id == (
                    device.organization_id
                ),
                models.PolicyAssignment.device_id.is_(None)
            )
            .first()
        )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No policy assigned to this device or organization"
        )

    policy = (
        db.query(models.Policy)
        .filter(models.Policy.id == assignment.policy_id)
        .first()
    )
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned policy not found"
        )

    # Resolve active published version
    if not policy.active_version_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned policy has no active version"
        )

    version = (
        db.query(models.PolicyVersion)
        .filter(
            models.PolicyVersion.id == policy.active_version_id,
            models.PolicyVersion.policy_id == policy.id,
            models.PolicyVersion.status == "PUBLISHED"
        )
        .first()
    )

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active policy version is not published or not found"
        )

    # Return response contract
    # Content hash format must be prefixed with "sha256:"
    content_hash_val = version.content_hash or ""
    if not content_hash_val.startswith("sha256:"):
        content_hash_val = f"sha256:{content_hash_val}"

    return {
        "policy_id": policy.id,
        "policy_name": policy.name,
        "version_id": version.id,
        "version_number": version.version_number,
        "schema_version": 1,
        "content": version.content or "",
        "content_hash": content_hash_val,
        "issued_at": version.created_at
    }


@router.get("/reports/export")
def export_csv_report(
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    # Retrieve authentication token from query parameter fallback or
    # authorization header
    auth_token = None
    if token:
        auth_token = token
    elif authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = security.decode_access_token(auth_token)
    if email is None:
        raise HTTPException(
            status_code=401, detail="Could not validate credentials"
        )

    current_user = (
        db.query(models.User).filter(models.User.email == email).first()
    )
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")

    memberships = [m.organization_id for m in current_user.memberships]
    devices = (
        db.query(models.Device)
        .filter(models.Device.organization_id.in_(memberships))
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Device ID",
            "Hostname",
            "OS",
            "OS Version",
            "Architecture",
            "Kernel Version",
            "Agent Version",
            "Status",
            "Compliance Status",
            "Compliance Score",
            "Last Check-in",
        ]
    )

    for dev in devices:
        writer.writerow(
            [
                str(dev.id),
                dev.hostname,
                dev.os_name,
                dev.os_version,
                dev.os_arch,
                dev.kernel_version,
                dev.agent_version,
                dev.status,
                dev.compliance_status,
                dev.compliance_score,
                dev.last_checkin.isoformat() if dev.last_checkin else "",
            ]
        )

    output.seek(0)

    response = StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv"
    )
    response.headers["Content-Disposition"] = (
        "attachment; filename=flientsec_compliance_report.csv"
    )
    return response


# =====================================================================
# Fleet Findings & Fleet Events Read APIs (Phase 4A)
# =====================================================================

def build_fleet_finding_response(
    finding: models.Finding, hostname: str, policy_name: Optional[str] = None
) -> schemas.FleetFindingResponse:
    return schemas.FleetFindingResponse(
        id=finding.id,
        device_id=finding.device_id,
        device_hostname=hostname,
        policy_id=finding.policy_id,
        policy_name=policy_name,
        rule_id=finding.rule_id,
        check_name=finding.check_name,
        severity=schemas.FindingSeverityEnum(finding.severity.upper()),
        status=schemas.FindingStatusEnum(finding.status),
        reason=finding.reason,
        drift_type=schemas.FindingDriftTypeEnum(finding.drift_type) if finding.drift_type else None,
        resolution_reason=finding.resolution_reason,
        first_detected_at=finding.first_detected_at,
        last_detected_at=finding.last_detected_at,
        resolved_at=finding.resolved_at,
        acknowledged_at=finding.acknowledged_at,
        acknowledged_by_id=finding.acknowledged_by_id,
        remediation_started_at=finding.remediation_started_at,
        remediation_started_by_id=finding.remediation_started_by_id,
        remediation_note=finding.remediation_note,
        waived_at=finding.waived_at,
        waived_by_id=finding.waived_by_id,
        waiver_reason=finding.waiver_reason,
        waiver_expires_at=finding.waiver_expires_at,
        waiver_owner=finding.waiver_owner,
        waiver_ticket_id=finding.waiver_ticket_id,
    )


@router.get("/findings", response_model=schemas.FleetFindingListResponse)
def get_fleet_findings(
    status: Optional[schemas.FindingStatusEnum] = Query(None),
    severity: Optional[schemas.FindingSeverityEnum] = Query(None),
    drift_type: Optional[schemas.FindingDriftTypeEnum] = Query(None),
    device_id: Optional[uuid.UUID] = Query(None),
    policy_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Tenant-scoped, fleet-wide query endpoint for Findings.
    Provides paginated results to hydrate the console findings view.
    """
    from sqlalchemy import case
    memberships = [m.organization_id for m in current_user.memberships]

    query = (
        db.query(models.Finding, models.Device.hostname, models.Policy.name)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .outerjoin(models.Policy, models.Finding.policy_id == models.Policy.id)
        .filter(models.Device.organization_id.in_(memberships))
    )

    # Apply filters using AND logic (intersection)
    if device_id is not None:
        query = query.filter(models.Finding.device_id == device_id)
    if policy_id is not None:
        query = query.filter(models.Finding.policy_id == policy_id)
    if status is not None:
        query = query.filter(models.Finding.status == status.value)
    if severity is not None:
        from sqlalchemy import func
        query = query.filter(func.lower(models.Finding.severity) == severity.value.lower())
    if drift_type is not None:
        query = query.filter(models.Finding.drift_type == drift_type.value)

    # Fetch total matching record count
    total = query.count()

    # Custom Operational Sorting:
    # 1. Active states (OPEN, ACKNOWLEDGED, IN_REMEDIATION, WAIVED) before RESOLVED
    # 2. HIGH before MEDIUM before LOW
    # 3. last_detected_at DESC
    # 4. id ASC
    status_order = case(
        (models.Finding.status != "RESOLVED", 0),
        else_=1
    )
    from sqlalchemy import func
    severity_order = case(
        (func.lower(models.Finding.severity) == "high", 0),
        (func.lower(models.Finding.severity) == "medium", 1),
        (func.lower(models.Finding.severity) == "low", 2),
        else_=3
    )

    query = query.order_by(
        status_order.asc(),
        severity_order.asc(),
        models.Finding.last_detected_at.desc(),
        models.Finding.id.asc()
    )

    query_results = query.offset(offset).limit(limit).all()

    items = [
        build_fleet_finding_response(finding, hostname, policy_name)
        for finding, hostname, policy_name in query_results
    ]

    return schemas.FleetFindingListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/findings/summary", response_model=schemas.FleetFindingSummaryResponse)
def get_findings_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns fleet operational finding metrics for triage header bars.
    """
    memberships = [m.organization_id for m in current_user.memberships]
    from datetime import timedelta
    from sqlalchemy import func

    base_q = (
        db.query(models.Finding)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .filter(models.Device.organization_id.in_(memberships))
    )

    open_count = base_q.filter(models.Finding.status == "OPEN").count()
    acknowledged_count = base_q.filter(models.Finding.status == "ACKNOWLEDGED").count()
    in_remediation_count = base_q.filter(models.Finding.status == "IN_REMEDIATION").count()
    waived_count = base_q.filter(models.Finding.status == "WAIVED").count()

    critical_high_count = (
        base_q.filter(
            models.Finding.status.in_(["OPEN", "ACKNOWLEDGED", "IN_REMEDIATION"]),
            func.lower(models.Finding.severity).in_(["high", "critical"])
        ).count()
    )

    resolved_count = base_q.filter(models.Finding.status == "RESOLVED").count()
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    resolved_recent_count = (
        base_q.filter(
            models.Finding.status == "RESOLVED",
            models.Finding.resolved_at >= seven_days_ago
        ).count()
    )

    total = base_q.count()

    return schemas.FleetFindingSummaryResponse(
        open_count=open_count,
        critical_high_count=critical_high_count,
        in_remediation_count=in_remediation_count,
        acknowledged_count=acknowledged_count,
        waived_count=waived_count,
        resolved_recent_count=resolved_recent_count,
        resolved_count=resolved_count,
        total=total
    )


@router.get("/findings/{id}", response_model=schemas.FleetFindingDetailResponse)
def get_finding_detail(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns comprehensive finding detail including operator attribution,
    structured OS-specific remediation guidance, and event history.
    """
    memberships = [m.organization_id for m in current_user.memberships]
    finding = (
        db.query(models.Finding)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .filter(
            models.Finding.id == id,
            models.Device.organization_id.in_(memberships)
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    device = finding.device
    policy_name = finding.policy.name if finding.policy else None

    # Associated events
    events = (
        db.query(models.Event)
        .filter(models.Event.finding_id == finding.id)
        .order_by(models.Event.timestamp.desc())
        .all()
    )
    event_items = [
        schemas.FleetEventResponse(
            id=e.id,
            type=schemas.EventTypeEnum(e.type),
            timestamp=e.timestamp,
            message=e.message,
            rule_name=e.rule_name,
            device_id=e.device_id,
            finding_id=e.finding_id,
            policy_version_id=e.policy_version_id,
        )
        for e in events
    ]

    # Authoritative remediation guidance
    guidance = remediation_service.get_remediation_guidance(
        rule_id=finding.rule_id,
        check_name=finding.check_name,
        observed_reason=finding.reason
    )

    base = build_fleet_finding_response(finding, device.hostname, policy_name)

    return schemas.FleetFindingDetailResponse(
        **base.model_dump(),
        acknowledged_by_email=finding.acknowledged_by.email if finding.acknowledged_by else None,
        remediation_started_by_email=finding.remediation_started_by.email if finding.remediation_started_by else None,
        waived_by_email=finding.waived_by.email if finding.waived_by else None,
        guidance=guidance,
        events=event_items
    )


@router.post("/findings/{id}/acknowledge", response_model=schemas.FleetFindingResponse)
def acknowledge_finding(
    id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Acknowledges an active security finding without altering device posture.
    """
    memberships = [m.organization_id for m in current_user.memberships]
    finding = (
        db.query(models.Finding)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .filter(
            models.Finding.id == id,
            models.Device.organization_id.in_(memberships)
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    if finding.status == "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Cannot acknowledge an already resolved finding."
        )

    finding.status = "ACKNOWLEDGED"
    finding.acknowledged_at = datetime.utcnow()
    finding.acknowledged_by_id = current_user.id

    event_id = uuid.uuid4()
    event = models.Event(
        id=event_id,
        device_id=finding.device_id,
        type="FINDING_ACKNOWLEDGED",
        rule_name=finding.rule_id,
        message=f"Finding for rule {finding.rule_id} acknowledged by {current_user.email}.",
        timestamp=datetime.utcnow(),
        finding_id=finding.id,
    )
    db.add(event)
    db.commit()
    db.refresh(finding)

    device = finding.device
    dispatch_webhooks_for_event(
        db=db,
        org_id=device.organization_id,
        event_data={
            "id": event_id,
            "type": "FINDING_ACKNOWLEDGED",
            "payload": {
                "id": str(event_id),
                "type": "FINDING_ACKNOWLEDGED",
                "version": "1",
                "timestamp": event.timestamp.isoformat(),
                "organization_id": str(device.organization_id),
                "actor": {"id": str(current_user.id), "email": current_user.email},
                "device": {"id": str(device.id), "hostname": device.hostname},
                "finding": {"id": str(finding.id), "rule_id": finding.rule_id, "status": finding.status}
            }
        }
    )

    return build_fleet_finding_response(finding, device.hostname, finding.policy.name if finding.policy else None)


@router.post("/findings/{id}/remediation", response_model=schemas.FleetFindingResponse)
def start_finding_remediation(
    id: uuid.UUID,
    req: schemas.FindingRemediationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Transitions an active finding to IN_REMEDIATION with optional operator note.
    """
    memberships = [m.organization_id for m in current_user.memberships]
    finding = (
        db.query(models.Finding)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .filter(
            models.Finding.id == id,
            models.Device.organization_id.in_(memberships)
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    if finding.status == "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Cannot mark an already resolved finding as in remediation."
        )

    finding.status = "IN_REMEDIATION"
    finding.remediation_started_at = datetime.utcnow()
    finding.remediation_started_by_id = current_user.id
    if req.note:
        finding.remediation_note = req.note.strip()

    event_id = uuid.uuid4()
    msg = f"Remediation started for rule {finding.rule_id} by {current_user.email}."
    if req.note:
        msg += f" Note: {req.note.strip()}"

    event = models.Event(
        id=event_id,
        device_id=finding.device_id,
        type="FINDING_REMEDIATION_STARTED",
        rule_name=finding.rule_id,
        message=msg,
        timestamp=datetime.utcnow(),
        finding_id=finding.id,
    )
    db.add(event)
    db.commit()
    db.refresh(finding)

    device = finding.device
    dispatch_webhooks_for_event(
        db=db,
        org_id=device.organization_id,
        event_data={
            "id": event_id,
            "type": "FINDING_REMEDIATION_STARTED",
            "payload": {
                "id": str(event_id),
                "type": "FINDING_REMEDIATION_STARTED",
                "version": "1",
                "timestamp": event.timestamp.isoformat(),
                "organization_id": str(device.organization_id),
                "actor": {"id": str(current_user.id), "email": current_user.email},
                "device": {"id": str(device.id), "hostname": device.hostname},
                "finding": {
                    "id": str(finding.id),
                    "rule_id": finding.rule_id,
                    "status": finding.status,
                    "note": finding.remediation_note
                }
            }
        }
    )

    return build_fleet_finding_response(finding, device.hostname, finding.policy.name if finding.policy else None)


@router.post("/findings/{id}/waive", response_model=schemas.FleetFindingResponse)
def waive_finding(
    id: uuid.UUID,
    req: schemas.FindingWaiverRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Grants a time-bounded exception/waiver on an active finding with explicit justification.
    """
    if not req.reason or not req.reason.strip():
        raise HTTPException(
            status_code=422,
            detail="Waiver reason is required and cannot be empty."
        )

    expires_at = req.expires_at
    if expires_at.tzinfo is not None:
        from datetime import timezone
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)

    if expires_at <= datetime.utcnow():
        raise HTTPException(
            status_code=422,
            detail="Waiver expiration date must be in the future."
        )

    memberships = [m.organization_id for m in current_user.memberships]
    finding = (
        db.query(models.Finding)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .filter(
            models.Finding.id == id,
            models.Device.organization_id.in_(memberships)
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    if finding.status == "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Cannot waive an already resolved finding."
        )

    finding.status = "WAIVED"
    finding.waived_at = datetime.utcnow()
    finding.waived_by_id = current_user.id
    finding.waiver_reason = req.reason.strip()
    finding.waiver_expires_at = expires_at
    finding.waiver_owner = req.owner.strip() if req.owner else None
    finding.waiver_ticket_id = req.ticket_id.strip() if req.ticket_id else None

    event_id = uuid.uuid4()
    exp_str = expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')
    msg = (
        f"Finding for rule {finding.rule_id} waived until {exp_str} by {current_user.email}. "
        f"Reason: {finding.waiver_reason}"
    )
    if finding.waiver_ticket_id:
        msg += f" (Ref: {finding.waiver_ticket_id})"

    event = models.Event(
        id=event_id,
        device_id=finding.device_id,
        type="FINDING_WAIVED",
        rule_name=finding.rule_id,
        message=msg,
        timestamp=datetime.utcnow(),
        finding_id=finding.id,
    )
    db.add(event)
    db.commit()
    db.refresh(finding)

    device = finding.device
    dispatch_webhooks_for_event(
        db=db,
        org_id=device.organization_id,
        event_data={
            "id": event_id,
            "type": "FINDING_WAIVED",
            "payload": {
                "id": str(event_id),
                "type": "FINDING_WAIVED",
                "version": "1",
                "timestamp": event.timestamp.isoformat(),
                "organization_id": str(device.organization_id),
                "actor": {"id": str(current_user.id), "email": current_user.email},
                "device": {"id": str(device.id), "hostname": device.hostname},
                "finding": {
                    "id": str(finding.id),
                    "rule_id": finding.rule_id,
                    "status": finding.status,
                    "reason": finding.waiver_reason,
                    "expires_at": finding.waiver_expires_at.isoformat()
                }
            }
        }
    )

    return build_fleet_finding_response(finding, device.hostname, finding.policy.name if finding.policy else None)


@router.get("/events", response_model=schemas.FleetEventListResponse)
def get_fleet_events(
    type: Optional[schemas.EventTypeEnum] = Query(None),
    device_id: Optional[uuid.UUID] = Query(None),
    finding_id: Optional[uuid.UUID] = Query(None),
    policy_version_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Tenant-scoped, fleet-wide query endpoint for Events.
    Exposes paginated activity feed list containing unified posture changes.
    """
    memberships = [m.organization_id for m in current_user.memberships]

    # Model Invariant: Tenant boundary matches either the Device organization
    # or the Policy organization for system-level audit events (such as POLICY_ROLLBACK).
    query = (
        db.query(
            models.Event,
            models.Device.hostname,
            models.Policy.name,
            models.PolicyVersion.version_number
        )
        .outerjoin(models.Device, models.Event.device_id == models.Device.id)
        .outerjoin(models.PolicyVersion, models.Event.policy_version_id == models.PolicyVersion.id)
        .outerjoin(models.Policy, models.PolicyVersion.policy_id == models.Policy.id)
        .filter(
            or_(
                models.Device.organization_id.in_(memberships),
                models.Policy.organization_id.in_(memberships)
            )
        )
    )

    # Apply filters using AND logic (intersection)
    if type is not None:
        query = query.filter(models.Event.type == type.value)
    if device_id is not None:
        query = query.filter(models.Event.device_id == device_id)
    if finding_id is not None:
        query = query.filter(models.Event.finding_id == finding_id)
    if policy_version_id is not None:
        query = query.filter(models.Event.policy_version_id == policy_version_id)

    # Fetch total matching record count
    total = query.count()

    # Deterministic sorting: Event timestamp DESC (newest first), then id ASC
    query = query.order_by(
        models.Event.timestamp.desc(),
        models.Event.id.asc()
    )

    # Paginate and execute SELECT
    query_results = query.offset(offset).limit(limit).all()

    items = []
    for event, hostname, policy_name, version_number in query_results:
        items.append(
            schemas.FleetEventResponse(
                id=event.id,
                type=schemas.EventTypeEnum(event.type),
                timestamp=event.timestamp,
                message=event.message,
                rule_name=event.rule_name,
                device_id=event.device_id,
                device_hostname=hostname,
                finding_id=event.finding_id,
                policy_version_id=event.policy_version_id,
                policy_name=policy_name,
                policy_version_number=version_number
            )
        )

    return schemas.FleetEventListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/maintenance/cleanup-checkruns")
def cleanup_checkruns(
    retention_days: int = Query(30, ge=1, le=365),
    batch_size: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    cutoff_timestamp = datetime.utcnow() - timedelta(days=retention_days)

    # Scoped to devices in user's organizations
    org_device_ids = [
        d.id for d in db.query(models.Device.id)
        .filter(models.Device.organization_id.in_(memberships))
        .all()
    ]

    if not org_device_ids:
        return {
            "status": "completed",
            "deleted_count": 0,
            "retention_days": retention_days,
            "cutoff_timestamp": cutoff_timestamp.isoformat()
        }

    # Fetch expired check runs up to batch_size
    expired_runs = (
        db.query(models.CheckRun.id)
        .filter(
            models.CheckRun.device_id.in_(org_device_ids),
            models.CheckRun.timestamp < cutoff_timestamp,
        )
        .limit(batch_size)
        .all()
    )

    deleted_count = 0
    if expired_runs:
        expired_ids = [r.id for r in expired_runs]
        deleted_count = (
            db.query(models.CheckRun)
            .filter(models.CheckRun.id.in_(expired_ids))
            .delete(synchronize_session=False)
        )
        db.commit()

    return {
        "status": "completed",
        "deleted_count": deleted_count,
        "retention_days": retention_days,
        "cutoff_timestamp": cutoff_timestamp.isoformat()
    }


# ==============================================================================
# Webhook APIs (Phase 7)
# ==============================================================================

@router.post("/webhooks", response_model=schemas.WebhookCreatedResponse)
def create_webhook(
    webhook_in: schemas.WebhookCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    if not memberships:
        raise HTTPException(
            status_code=400, detail="User has no organization membership"
        )
    org_id = memberships[0]

    # SSRF Protection
    is_valid, err_msg = webhook_service.validate_webhook_url(
        webhook_in.endpoint_url
    )
    if not is_valid:
        raise HTTPException(
            status_code=400, detail=f"Invalid webhook URL: {err_msg}"
        )

    # Generate cryptographically secure secret (32 bytes hex)
    secret = secrets.token_hex(32)

    # Validate subscribed events
    allowed_events = {
        "VIOLATION_TRIGGERED",
        "VIOLATION_RESOLVED",
        "POLICY_ROLLBACK",
    }
    events_list = webhook_in.events or [
        "VIOLATION_TRIGGERED",
        "VIOLATION_RESOLVED",
    ]
    for e in events_list:
        if e not in allowed_events:
            raise HTTPException(
                status_code=400, detail=f"Unsupported event type: {e}"
            )

    webhook = models.Webhook(
        id=uuid.uuid4(),
        organization_id=org_id,
        name=webhook_in.name,
        endpoint_url=webhook_in.endpoint_url,
        signing_secret=secret,
        enabled=webhook_in.enabled if webhook_in.enabled is not None else True,
        events=json.dumps(events_list),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    return schemas.WebhookCreatedResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        name=webhook.name,
        endpoint_url=webhook.endpoint_url,
        signing_secret=secret,  # Only returned once on creation
        enabled=webhook.enabled,
        events=json.loads(webhook.events),
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.get("/webhooks", response_model=List[schemas.WebhookResponse])
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    webhooks = (
        db.query(models.Webhook)
        .filter(models.Webhook.organization_id.in_(memberships))
        .order_by(models.Webhook.created_at.desc())
        .all()
    )
    res = []
    for w in webhooks:
        try:
            evts = json.loads(w.events)
        except Exception:
            evts = ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]
        res.append(
            schemas.WebhookResponse(
                id=w.id,
                organization_id=w.organization_id,
                name=w.name,
                endpoint_url=w.endpoint_url,
                enabled=w.enabled,
                events=evts,
                created_at=w.created_at,
                updated_at=w.updated_at,
            )
        )
    return res


@router.get(
    "/webhooks/{webhook_id}", response_model=schemas.WebhookDetailResponse
)
def get_webhook_detail(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    webhook = (
        db.query(models.Webhook)
        .filter(
            models.Webhook.id == webhook_id,
            models.Webhook.organization_id.in_(memberships),
        )
        .first()
    )
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    deliveries = (
        db.query(models.WebhookDelivery)
        .filter(models.WebhookDelivery.webhook_id == webhook.id)
        .order_by(models.WebhookDelivery.created_at.desc())
        .limit(20)
        .all()
    )

    try:
        evts = json.loads(webhook.events)
    except Exception:
        evts = ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]

    delivery_items = [
        schemas.WebhookDeliveryResponse(
            id=d.id,
            webhook_id=d.webhook_id,
            event_id=d.event_id,
            event_type=d.event_type,
            status=d.status,
            attempt_count=d.attempt_count,
            response_status_code=d.response_status_code,
            error_message=d.error_message,
            delivered_at=d.delivered_at,
            created_at=d.created_at,
        )
        for d in deliveries
    ]

    return schemas.WebhookDetailResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        name=webhook.name,
        endpoint_url=webhook.endpoint_url,
        enabled=webhook.enabled,
        events=evts,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
        recent_deliveries=delivery_items,
    )


@router.patch(
    "/webhooks/{webhook_id}", response_model=schemas.WebhookResponse
)
def update_webhook(
    webhook_id: uuid.UUID,
    webhook_in: schemas.WebhookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    webhook = (
        db.query(models.Webhook)
        .filter(
            models.Webhook.id == webhook_id,
            models.Webhook.organization_id.in_(memberships),
        )
        .first()
    )
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if webhook_in.endpoint_url is not None:
        is_valid, err_msg = webhook_service.validate_webhook_url(
            webhook_in.endpoint_url
        )
        if not is_valid:
            raise HTTPException(
                status_code=400, detail=f"Invalid webhook URL: {err_msg}"
            )
        webhook.endpoint_url = webhook_in.endpoint_url

    if webhook_in.name is not None:
        webhook.name = webhook_in.name

    if webhook_in.enabled is not None:
        webhook.enabled = webhook_in.enabled

    if webhook_in.events is not None:
        allowed_events = {
            "VIOLATION_TRIGGERED",
            "VIOLATION_RESOLVED",
            "POLICY_ROLLBACK",
        }
        for e in webhook_in.events:
            if e not in allowed_events:
                raise HTTPException(
                    status_code=400, detail=f"Unsupported event type: {e}"
                )
        webhook.events = json.dumps(webhook_in.events)

    webhook.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(webhook)

    try:
        evts = json.loads(webhook.events)
    except Exception:
        evts = ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]

    return schemas.WebhookResponse(
        id=webhook.id,
        organization_id=webhook.organization_id,
        name=webhook.name,
        endpoint_url=webhook.endpoint_url,
        enabled=webhook.enabled,
        events=evts,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    webhook = (
        db.query(models.Webhook)
        .filter(
            models.Webhook.id == webhook_id,
            models.Webhook.organization_id.in_(memberships),
        )
        .first()
    )
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    db.delete(webhook)
    db.commit()
    return {"status": "deleted", "id": str(webhook_id)}


@router.post(
    "/webhooks/{webhook_id}/test",
    response_model=schemas.WebhookDeliveryResponse,
)
def test_webhook(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = [m.organization_id for m in current_user.memberships]
    webhook = (
        db.query(models.Webhook)
        .filter(
            models.Webhook.id == webhook_id,
            models.Webhook.organization_id.in_(memberships),
        )
        .first()
    )
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_event_id = uuid.uuid4()
    test_payload = {
        "id": str(test_event_id),
        "type": "TEST_EVENT",
        "version": "1",
        "timestamp": datetime.utcnow().isoformat(),
        "organization_id": str(webhook.organization_id),
        "message": (
            f"FlientSec integration test event for webhook '{webhook.name}'."
        ),
    }

    delivery = webhook_service.deliver_webhook_sync(
        db=db,
        webhook_id=webhook.id,
        event_id=test_event_id,
        event_type="TEST_EVENT",
        payload_dict=test_payload,
        max_retries=1,
    )
    if not delivery:
        raise HTTPException(
            status_code=400,
            detail="Failed to initiate test webhook delivery",
        )

    return schemas.WebhookDeliveryResponse(
        id=delivery.id,
        webhook_id=delivery.webhook_id,
        event_id=delivery.event_id,
        event_type=delivery.event_type,
        status=delivery.status,
        attempt_count=delivery.attempt_count,
        response_status_code=delivery.response_status_code,
        error_message=delivery.error_message,
        delivered_at=delivery.delivered_at,
        created_at=delivery.created_at,
    )


# ==========================================
# Phase 8 — Compliance & Evidence Endpoints
# ==========================================


@router.get("/compliance/summary", response_model=schemas.ComplianceSummaryResponse)
def get_compliance_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.memberships:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_id = current_user.memberships[0].organization_id
    summary = compliance_service.calculate_fleet_compliance_summary(db, org_id)
    return summary


@router.get("/compliance/controls", response_model=List[schemas.ControlPostureSummary])
def get_compliance_controls(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.memberships:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_id = current_user.memberships[0].organization_id
    controls = compliance_service.get_compliance_controls_posture(db, org_id)
    return controls


@router.get("/compliance/controls/{control_id}", response_model=schemas.ControlDetailResponse)
def get_compliance_control_detail(
    control_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.memberships:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_id = current_user.memberships[0].organization_id
    detail = compliance_service.get_control_detail(db, org_id, control_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Control '{control_id}' not found")
    return detail


@router.get("/devices/{device_id}/compliance", response_model=schemas.DeviceComplianceResponse)
def get_device_compliance(
    device_id: uuid.UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == device_id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    posture = compliance_service.get_device_compliance_posture(db, device.organization_id, device.id)
    if not posture:
        raise HTTPException(status_code=404, detail="Device compliance posture not found")
    return posture


@router.get("/devices/{device_id}/evidence", response_model=schemas.EvidenceListResponse)
def get_device_evidence(
    device_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = [m.organization_id for m in current_user.memberships]
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == device_id,
            models.Device.organization_id.in_(memberships),
        )
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    total, items = compliance_service.get_device_evidence_history(
        db, device.organization_id, device.id, limit=limit, offset=offset
    )

    resp_items = []
    for ev in items:
        resp_items.append(
            schemas.EvidenceResponse(
                id=ev.id,
                organization_id=ev.organization_id,
                device_id=ev.device_id,
                hostname=device.hostname,
                control_id=ev.control_id,
                rule_id=ev.rule_id,
                check_run_id=ev.check_run_id,
                policy_version_id=ev.policy_version_id,
                status=ev.status,
                severity=ev.severity,
                observed_result=ev.observed_result,
                evaluation_timestamp=ev.evaluation_timestamp,
                evidence_hash=ev.evidence_hash,
                created_at=ev.created_at,
            )
        )
    return schemas.EvidenceListResponse(
        total=total, limit=limit, offset=offset, items=resp_items
    )


@router.get("/compliance/evidence", response_model=schemas.EvidenceListResponse)
def get_fleet_evidence(
    control_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    device_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.memberships:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_id = current_user.memberships[0].organization_id

    # If device_id is provided, verify it belongs to org
    if device_id:
        dev = (
            db.query(models.Device)
            .filter(
                models.Device.id == device_id,
                models.Device.organization_id == org_id
            )
            .first()
        )
        if not dev:
            raise HTTPException(status_code=404, detail="Device not found")

    total, items = compliance_service.get_fleet_evidence_feed(
        db, org_id, control_id=control_id, status=status_filter, device_id=device_id, limit=limit, offset=offset
    )

    device_ids = list({ev.device_id for ev in items})
    device_map = {}
    if device_ids:
        devs = db.query(models.Device).filter(models.Device.id.in_(device_ids)).all()
        device_map = {d.id: d.hostname for d in devs}

    resp_items = []
    for ev in items:
        resp_items.append(
            schemas.EvidenceResponse(
                id=ev.id,
                organization_id=ev.organization_id,
                device_id=ev.device_id,
                hostname=device_map.get(ev.device_id, "Unknown"),
                control_id=ev.control_id,
                rule_id=ev.rule_id,
                check_run_id=ev.check_run_id,
                policy_version_id=ev.policy_version_id,
                status=ev.status,
                severity=ev.severity,
                observed_result=ev.observed_result,
                evaluation_timestamp=ev.evaluation_timestamp,
                evidence_hash=ev.evidence_hash,
                created_at=ev.created_at,
            )
        )
    return schemas.EvidenceListResponse(
        total=total, limit=limit, offset=offset, items=resp_items
    )
