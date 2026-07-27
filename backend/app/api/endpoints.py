import csv
import io
import uuid
import yaml
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
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
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
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
    x_device_token: Optional[str] = Header(None)
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
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user, None

# Helper to retrieve default organization ID
def get_default_organization(db: Session) -> models.Organization:
    org = db.query(models.Organization).order_by(models.Organization.created_at.asc()).first()
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
    admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
    if not admin_user:
        admin_user = models.User(
            email=admin_email,
            hashed_password=security.get_password_hash("flientsec_admin_pass")
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        # Make Owner of default organization
        member = models.Member(
            user_id=admin_user.id,
            organization_id=org.id,
            role="owner"
        )
        db.add(member)
        db.commit()
    else:
        # Guarantee credentials and membership are synced
        admin_user.hashed_password = security.get_password_hash("flientsec_admin_pass")
        db.commit()
        
        member = db.query(models.Member).filter(
            models.Member.user_id == admin_user.id,
            models.Member.organization_id == org.id
        ).first()
        if not member:
            member = models.Member(
                user_id=admin_user.id,
                organization_id=org.id,
                role="owner"
            )
            db.add(member)
            db.commit()

# Helper to authorize agent telemetry calls using client device tokens
def verify_device_token(device_uuid: str, x_device_token: str, db: Session) -> models.Device:
    try:
        dev_id = uuid.UUID(device_uuid)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UUID format")
        
    device = db.query(models.Device).filter(models.Device.id == dev_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        
    if device.status == "DECOMMISSIONED":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device has been decommissioned")
        
    if not device.device_token or device.device_token != x_device_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device credentials")
        
    return device

# Public Endpoints
@router.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@router.get("/version")
def version_check():
    return {"version": "1.0.0", "supported_agent_versions": ["1.0.0"]}

@router.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    ensure_default_data(db)
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
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
    user = db.query(models.User).filter(models.User.email == login_in.email).first()
    if user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        
    user = models.User(
        email=login_in.email,
        hashed_password=security.get_password_hash(login_in.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create default personal organization for user
    org = models.Organization(name=f"{login_in.email.split('@')[0]}'s Workspace")
    db.add(org)
    db.commit()
    db.refresh(org)
    
    # Map user as Owner of new workspace
    member = models.Member(
        user_id=user.id,
        organization_id=org.id,
        role="owner"
    )
    db.add(member)
    db.commit()
    
    return {"status": "registered", "organization": org.name}

# Agent REST APIs
@router.post("/agent/register")
def register_device(device_in: schemas.DeviceRegister, enrollment_token: str = Header(...), db: Session = Depends(get_db)):
    # Validate enrollment token or fallback to default org for MVP compatibility
    org = None
    tok = None
    if enrollment_token == "default_token" or enrollment_token == "flientsec_enroll_token_hash":
        org = get_default_organization(db)
    else:
        # Check active enrollment tokens inside db
        tok = db.query(models.EnrollmentToken).filter(models.EnrollmentToken.token_hash == enrollment_token).first()
        if tok:
            if tok.expires_at < datetime.utcnow():
                raise HTTPException(status_code=status.HTTP_410_GONE, detail="Enrollment token expired")
            org = tok.organization
            
    if not org:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid enrollment token")

    # Check if device already registered
    device = db.query(models.Device).filter(models.Device.id == device_in.id).first()
    
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
            last_checkin=datetime.utcnow()
        )
        db.add(device)
    else:
        # Re-register / reset token on reinstallations
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
def agent_heartbeat(device_uuid: str = Header(...), x_device_token: str = Header(...), db: Session = Depends(get_db)):
    device = verify_device_token(device_uuid, x_device_token, db)
    device.status = "ONLINE"
    device.last_checkin = datetime.utcnow()
    db.commit()
    return {"status": "ok"}

@router.post("/agent/checkin", response_model=schemas.CheckRunResponse)
def agent_checkin(checkrun_in: schemas.CheckRunCreate, device_uuid: str = Header(...), x_device_token: str = Header(...), db: Session = Depends(get_db)):
    device = verify_device_token(device_uuid, x_device_token, db)

    # Fetch previous failed check rule names to determine transitions
    prev_failed_rules = {f.check_name for f in device.findings if f.status == "Open"}

    # Save CheckRun log
    check_run = models.CheckRun(
        id=checkrun_in.id,
        device_id=device.id,
        timestamp=checkrun_in.timestamp,
        status=checkrun_in.status,
        score=checkrun_in.score
    )
    db.add(check_run)

    # Re-evaluate active findings linked to this device
    new_failed_rules = set()
    for f_in in checkrun_in.findings:
        # Create or update active finding
        finding = db.query(models.Finding).filter(
            models.Finding.device_id == device.id,
            models.Finding.check_name == f_in.check_name,
            models.Finding.status == "Open"
        ).first()
        
        if not finding:
            finding = models.Finding(
                id=uuid.uuid4(),
                device_id=device.id,
                check_name=f_in.check_name,
                severity=f_in.severity,
                status="Open",
                reason=f_in.reason,
                created_at=datetime.utcnow()
            )
            db.add(finding)
        else:
            finding.reason = f_in.reason
            
        new_failed_rules.add(f_in.check_name)

    # Resolve findings no longer reported
    for check_name in prev_failed_rules:
        if check_name not in new_failed_rules:
            finding = db.query(models.Finding).filter(
                models.Finding.device_id == device.id,
                models.Finding.check_name == check_name,
                models.Finding.status == "Open"
            ).first()
            if finding:
                finding.status = "Resolved"
                finding.resolved_at = datetime.utcnow()

    # Process events based on diffs
    all_monitored_rules = prev_failed_rules.union(new_failed_rules)
    for rule in all_monitored_rules:
        if rule in new_failed_rules and rule not in prev_failed_rules:
            # Trigger Event
            event_msg = f"Violation triggered: {rule.capitalize()} policy failed."
            event = models.Event(
                device_id=device.id,
                type="VIOLATION_TRIGGERED",
                rule_name=rule,
                message=event_msg,
                timestamp=datetime.utcnow()
            )
            db.add(event)
        elif rule not in new_failed_rules and rule in prev_failed_rules:
            # Resolved Event
            event_msg = f"Violation resolved: {rule.capitalize()} policy is now compliant."
            event = models.Event(
                device_id=device.id,
                type="VIOLATION_RESOLVED",
                rule_name=rule,
                message=event_msg,
                timestamp=datetime.utcnow()
            )
            db.add(event)

    # Update Device stats
    device.status = "ONLINE"
    device.compliance_status = checkrun_in.status
    device.compliance_score = checkrun_in.score
    device.last_checkin = datetime.utcnow()

    db.commit()
    db.refresh(check_run)
    return check_run

# Enrollment Token APIs (Requires auth)
@router.get("/enrollment-tokens", response_model=List[schemas.EnrollmentTokenResponse])
def list_enrollment_tokens(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    return db.query(models.EnrollmentToken).filter(models.EnrollmentToken.organization_id.in_(memberships)).all()

@router.post("/enrollment-tokens", response_model=schemas.EnrollmentTokenResponse)
def create_enrollment_token(token_in: schemas.EnrollmentTokenCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.memberships:
        raise HTTPException(status_code=400, detail="User is not part of any organization")
    org_id = current_user.memberships[0].organization_id
    
    # Generate a secure token string
    token_val = f"flientsec_enroll_{uuid.uuid4().hex}"
    tok = models.EnrollmentToken(
        id=uuid.uuid4(),
        organization_id=org_id,
        token_hash=token_val,
        created_by=current_user.id,
        expires_at=token_in.expires_at,
        created_at=datetime.utcnow()
    )
    db.add(tok)
    db.commit()
    db.refresh(tok)
    return tok

@router.post("/enrollment-tokens/{id}/revoke", response_model=schemas.EnrollmentTokenResponse)
def revoke_enrollment_token(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    tok = db.query(models.EnrollmentToken).filter(models.EnrollmentToken.id == id, models.EnrollmentToken.organization_id.in_(memberships)).first()
    if not tok:
        raise HTTPException(status_code=404, detail="Token not found")
    
    db.delete(tok)
    db.commit()
    return tok

# Dashboard APIs (Requires auth)
@router.get("/devices", response_model=List[schemas.DeviceResponse])
def list_devices(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Find matching organizations memberships
    memberships = [m.organization_id for m in current_user.memberships]
    
    # Update offline states based on check-in timeouts (> 2 minutes means OFFLINE for dashboard preview)
    timeout_threshold = datetime.utcnow() - timedelta(minutes=2)
    offline_devices = db.query(models.Device).filter(
        models.Device.last_checkin < timeout_threshold,
        models.Device.status == "ONLINE"
    ).all()
    for dev in offline_devices:
        dev.status = "OFFLINE"
    if offline_devices:
        db.commit()

    return db.query(models.Device).filter(models.Device.organization_id.in_(memberships), models.Device.status != "DECOMMISSIONED").all()

@router.get("/devices/{id}", response_model=schemas.DeviceResponse)
def get_device(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.organization_id.in_(memberships)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.get("/devices/{id}/latest-run", response_model=Optional[schemas.CheckRunResponse])
def get_device_latest_run(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.organization_id.in_(memberships)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    run = db.query(models.CheckRun).filter(models.CheckRun.device_id == id).order_by(models.CheckRun.timestamp.desc()).first()
    return run

@router.get("/devices/{id}/history", response_model=List[schemas.EventResponse])
def get_device_history(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.organization_id.in_(memberships)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return db.query(models.Event).filter(models.Event.device_id == id).order_by(models.Event.timestamp.desc()).all()

@router.get("/devices/{id}/findings", response_model=List[schemas.FindingResponse])
def get_device_findings(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.organization_id.in_(memberships)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return db.query(models.Finding).filter(models.Finding.device_id == id).order_by(models.Finding.created_at.desc()).all()

def seed_default_policy(db: Session, admin_user: models.User) -> models.Policy:
    org = None
    if admin_user.memberships:
        org_id = admin_user.memberships[0].organization_id
        org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        org = get_default_organization(db)
        
    policy = db.query(models.Policy).filter(models.Policy.organization_id == org.id).first()
    if not policy:
        policy = models.Policy(
            organization_id=org.id,
            name=f"{org.name} Baseline Policy",
            description="Default workstation configuration checks definition."
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
        
        # Seed Policy Version 1
        default_rules = {
            "checks": {
                "firewall": {"enabled": True, "required": True, "severity": "HIGH"},
                "encryption": {"enabled": True, "required": True, "severity": "HIGH"},
                "ssh": {"enabled": True, "required": False, "severity": "MEDIUM"},
                "updates": {"enabled": True, "required": True, "severity": "MEDIUM"},
                "runtime": {"enabled": True, "required": True, "severity": "MEDIUM"}
            }
        }
        ver = models.PolicyVersion(
            policy_id=policy.id,
            version_number=1,
            definition_json=json.dumps(default_rules),
            created_by=admin_user.id
        )
        db.add(ver)
        db.commit()
    return policy

@router.get("/policies", response_model=schemas.PolicyResponse)
def get_policies(db: Session = Depends(get_db), auth_result = Depends(get_current_user_or_device)):
    # Returns first policy or generates default organizational workspace mapping
    current_user, org = auth_result
    if current_user:
        if current_user.memberships:
            org_id = current_user.memberships[0].organization_id
            org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
        if not org:
            org = get_default_organization(db)
        
    policy = db.query(models.Policy).filter(models.Policy.organization_id == org.id).first()
    if not policy:
        admin_user = db.query(models.User).filter(models.User.email == "admin@flientsec.local").first()
        policy = seed_default_policy(db, admin_user or current_user)

    # Get latest version definition and serialize to YAML
    latest_version = db.query(models.PolicyVersion).filter(models.PolicyVersion.policy_id == policy.id).order_by(models.PolicyVersion.version_number.desc()).first()
    if latest_version:
        try:
            rules_dict = json.loads(latest_version.definition_json)
            policy.rules_yaml = yaml.dump(rules_dict, default_flow_style=False)
        except Exception:
            policy.rules_yaml = ""
    else:
        policy.rules_yaml = ""
        
    return policy

@router.post("/policies", response_model=schemas.PolicyResponse)
def update_policy(
    policy_in: schemas.PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    org = None
    if current_user.memberships:
        org_id = current_user.memberships[0].organization_id
        org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        org = get_default_organization(db)
        
    policy = db.query(models.Policy).filter(models.Policy.organization_id == org.id).first()
    if not policy:
        policy = seed_default_policy(db, current_user)
        
    # Validate YAML correctness
    try:
        rules_dict = yaml.safe_load(policy_in.rules_yaml)
        if not isinstance(rules_dict, dict) or "checks" not in rules_dict:
            raise HTTPException(status_code=400, detail="Policy must define a 'checks' root object")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML configuration: {str(e)}")
        
    last_ver = db.query(models.PolicyVersion).filter(models.PolicyVersion.policy_id == policy.id).order_by(models.PolicyVersion.version_number.desc()).first()
    next_num = (last_ver.version_number + 1) if last_ver else 1
    
    new_ver = models.PolicyVersion(
        policy_id=policy.id,
        version_number=next_num,
        definition_json=json.dumps(rules_dict),
        created_by=current_user.id
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)
    
    policy.rules_yaml = policy_in.rules_yaml
    return policy

@router.get("/policies/{id}/versions", response_model=List[schemas.PolicyVersionResponse])
def list_policy_versions(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = db.query(models.Policy).filter(models.Policy.id == id, models.Policy.organization_id.in_(memberships)).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return db.query(models.PolicyVersion).filter(models.PolicyVersion.policy_id == id).order_by(models.PolicyVersion.version_number.desc()).all()

@router.post("/policies/{id}/versions", response_model=schemas.PolicyVersionResponse)
def create_policy_version(id: uuid.UUID, rules_json: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    policy = db.query(models.Policy).filter(models.Policy.id == id, models.Policy.organization_id.in_(memberships)).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    # Check JSON correctness
    try:
        json.loads(rules_json)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON specification: {str(e)}")
        
    last_ver = db.query(models.PolicyVersion).filter(models.PolicyVersion.policy_id == id).order_by(models.PolicyVersion.version_number.desc()).first()
    next_num = (last_ver.version_number + 1) if last_ver else 1
    
    new_ver = models.PolicyVersion(
        policy_id=id,
        version_number=next_num,
        definition_json=rules_json,
        created_by=current_user.id
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)
    return new_ver

@router.get("/reports/export")
def export_csv_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = [m.organization_id for m in current_user.memberships]
    devices = db.query(models.Device).filter(models.Device.organization_id.in_(memberships)).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Device ID", "Hostname", "OS", "OS Version", "Architecture", 
        "Kernel Version", "Agent Version", "Status", "Compliance Status", 
        "Compliance Score", "Last Check-in"
    ])
    
    for dev in devices:
        writer.writerow([
            str(dev.id), dev.hostname, dev.os_name, dev.os_version, dev.os_arch,
            dev.kernel_version, dev.agent_version, dev.status, dev.compliance_status,
            dev.compliance_score, dev.last_checkin.isoformat() if dev.last_checkin else ""
        ])
        
    output.seek(0)
    
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=flientsec_compliance_report.csv"
    return response
