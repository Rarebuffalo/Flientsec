import csv
import io
import uuid
import yaml
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core import security
from app.models import models
from app.schemas import schemas

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


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
    device_uuid: str = Header(...),
    x_device_token: str = Header(...),
    db: Session = Depends(get_db),
):
    device = verify_device_token(device_uuid, x_device_token, db)

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
        # Extract evaluated rules from the policy version JSON/YAML
        import json as py_json
        try:
            policy_data = py_json.loads(version.definition_json)
            rules_list = policy_data.get("rules", [])
        except Exception:
            rules_list = []

        # Dict mapping rule_id -> parsed rule configuration dict
        evaluated_rules = {r.get("id"): r for r in rules_list if r.get("id")}

        # Process reported failures
        new_failed_rules = set()
        for f_in in checkrun_in.findings:
            rule_id = f_in.rule_id
            new_failed_rules.add(rule_id)

            # Query existing active OPEN finding
            finding = (
                db.query(models.Finding)
                .filter(
                    models.Finding.device_id == device.id,
                    models.Finding.policy_id == version.policy_id,
                    models.Finding.rule_id == rule_id,
                    models.Finding.status == "OPEN",
                )
                .first()
            )

            if finding:
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

                # Trigger Event
                event = models.Event(
                    device_id=device.id,
                    type="VIOLATION_TRIGGERED",
                    rule_name=rule_id,
                    message=f"Violation triggered: Rule {rule_id} failed.",
                    timestamp=datetime.utcnow(),
                    finding_id=finding.id,
                    policy_version_id=version.id
                )
                db.add(event)

        # Process resolved and removed rules
        open_findings = (
            db.query(models.Finding)
            .filter(
                models.Finding.device_id == device.id,
                models.Finding.policy_id == version.policy_id,
                models.Finding.status == "OPEN",
            )
            .all()
        )

        for f in open_findings:
            rule_id = f.rule_id
            if rule_id not in new_failed_rules:
                # Determine if rule was evaluated or removed
                if rule_id in evaluated_rules:
                    # Evaluated but did not fail -> REMEDIATED
                    f.status = "RESOLVED"
                    f.resolved_at = datetime.utcnow()
                    f.resolution_reason = "REMEDIATED"

                    event = models.Event(
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

    # 5. Update Device stats
    device.status = "ONLINE"
    device.compliance_status = checkrun_in.status
    device.compliance_score = checkrun_in.score
    device.last_checkin = datetime.utcnow()

    db.commit()
    db.refresh(check_run)
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
        ver = models.PolicyVersion(
            policy_id=policy.id,
            version_number=1,
            definition_json=json.dumps(default_rules),
            created_by=admin_user.id,
        )
        db.add(ver)
        db.commit()
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
        policy = seed_default_policy(db, admin_user or current_user)

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

    return policy


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

    # Model Invariant: Device is the authoritative tenant boundary (Device.organization_id).
    # Findings and Events are child resources of Device, meaning their tenant-scoping is
    # transitively governed by the Device they belong to. When joining Policy or PolicyVersion
    # for display purposes, we outerjoin on standard FK relationships. Since the outer query
    # strictly filters by models.Device.organization_id.in_(memberships), it is impossible
    # for findings/events of other organizations to be queried, thus preventing any cross-organization
    # policy leak.
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
        # Perform case-insensitive comparison to handle legacy seed and mixed-case entries robustly
        query = query.filter(func.lower(models.Finding.severity) == severity.value.lower())
    if drift_type is not None:
        query = query.filter(models.Finding.drift_type == drift_type.value)

    # Fetch total matching record count
    total = query.count()

    # Custom Operational Sorting:
    # 1. OPEN before RESOLVED
    # 2. HIGH before MEDIUM before LOW (DB strings compared case-insensitively, order weight reflects database values)
    # 3. last_detected_at DESC (Observe most recently detected violations first)
    # 4. id ASC (Deterministic pagination tie-breaker)
    status_order = case(
        (models.Finding.status == "OPEN", 0),
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

    # Paginate and execute SELECT
    query_results = query.offset(offset).limit(limit).all()

    items = []
    for finding, hostname, policy_name in query_results:
        items.append(
            schemas.FleetFindingResponse(
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
                resolved_at=finding.resolved_at
            )
        )

    return schemas.FleetFindingListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


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

    # Model Invariant: Device is the authoritative tenant boundary (Device.organization_id).
    # Joined metadata (Policy, PolicyVersion) is resolved strictly relative to events
    # which are matched to Devices inside the tenant's organization list.
    query = (
        db.query(
            models.Event,
            models.Device.hostname,
            models.Policy.name,
            models.PolicyVersion.version_number
        )
        .join(models.Device, models.Event.device_id == models.Device.id)
        .outerjoin(models.PolicyVersion, models.Event.policy_version_id == models.PolicyVersion.id)
        .outerjoin(models.Policy, models.PolicyVersion.policy_id == models.Policy.id)
        .filter(models.Device.organization_id.in_(memberships))
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
