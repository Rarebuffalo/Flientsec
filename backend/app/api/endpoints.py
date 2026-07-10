import csv
import io
import uuid
from uuid import UUID
import yaml
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core import security
from app.models import models
from app.schemas import schemas

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

# Help helper to fetch current user from JWT token
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

# Helper to retrieve default company ID
def get_default_company(db: Session) -> models.Company:
    company = db.query(models.Company).order_by(models.Company.created_at.asc()).first()
    if not company:
        company = models.Company(name="FlientSec Default Corp")
        db.add(company)
        db.commit()
        db.refresh(company)
    return company

def ensure_default_data(db: Session):
    company = get_default_company(db)
    
    admin_email = "admin@flientsec.local"
    admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
    if not admin_user:
        admin_user = models.User(
            email=admin_email,
            hashed_password=security.get_password_hash("flientsec_admin_pass"),
            role="admin",
            company_id=company.id
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    else:
        # Guarantee credentials are synced
        admin_user.hashed_password = security.get_password_hash("flientsec_admin_pass")
        admin_user.company_id = company.id
        db.commit()

# Public Endpoints
@router.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@router.get("/debug-db")
def debug_db(db: Session = Depends(get_db)):
    seed_status = "success"
    seed_error = None
    try:
        ensure_default_data(db)
    except Exception as e:
        seed_status = "error"
        seed_error = str(e)
        
    users = db.query(models.User).all()
    user_list = []
    for u in users:
        # Verify plain password
        match = security.verify_password("flientsec_admin_pass", u.hashed_password)
        user_list.append({
            "email": u.email,
            "role": u.role,
            "company_id": str(u.company_id) if u.company_id else None,
            "password_match": match
        })
    
    try:
        test_hash = security.get_password_hash("test_pass")
        hash_status = "success"
        hash_error = None
    except Exception as e:
        test_hash = None
        hash_status = "error"
        hash_error = str(e)

    companies = db.query(models.Company).all()
    company_list = [{"id": str(c.id), "name": c.name} for c in companies]
    
    return {
        "seed_status": seed_status,
        "seed_error": seed_error,
        "user_count": len(users),
        "users": user_list,
        "company_count": len(companies),
        "companies": company_list,
        "hash_test": {
            "status": hash_status,
            "hash": test_hash,
            "error": hash_error
        }
    }

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

# Agent APIs
@router.post("/agent/register", response_model=schemas.DeviceResponse)
def register_device(device_in: schemas.DeviceRegister, db: Session = Depends(get_db)):
    # Check if already exists
    device = db.query(models.Device).filter(models.Device.id == device_in.id).first()
    company = get_default_company(db)
    
    if not device:
        device = models.Device(
            id=device_in.id,
            company_id=company.id,
            hostname=device_in.hostname,
            os_name=device_in.os_name,
            os_version=device_in.os_version,
            os_arch=device_in.os_arch,
            kernel_version=device_in.kernel_version,
            agent_version=device_in.agent_version,
            status="ONLINE",
            compliance_status="UNKNOWN",
            compliance_score=100,
            last_checkin=datetime.utcnow()
        )
        db.add(device)
    else:
        # Update mutable fields
        device.hostname = device_in.hostname
        device.os_name = device_in.os_name
        device.os_version = device_in.os_version
        device.os_arch = device_in.os_arch
        device.kernel_version = device_in.kernel_version
        device.agent_version = device_in.agent_version
        device.status = "ONLINE"
        device.last_checkin = datetime.utcnow()
    
    db.commit()
    db.refresh(device)
    return device

@router.post("/agent/heartbeat")
def agent_heartbeat(device_id: str, db: Session = Depends(get_db)):
    try:
        dev_uuid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
        
    device = db.query(models.Device).filter(models.Device.id == dev_uuid).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not registered")
    
    device.status = "ONLINE"
    device.last_checkin = datetime.utcnow()
    db.commit()
    return {"status": "ok"}

@router.post("/agent/checkin", response_model=schemas.CheckRunResponse)
def agent_checkin(device_id: str, checkrun_in: schemas.CheckRunCreate, db: Session = Depends(get_db)):
    try:
        dev_uuid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    device = db.query(models.Device).filter(models.Device.id == dev_uuid).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not registered")

    # Fetch previous run to do finding state transitions
    prev_run = db.query(models.CheckRun).filter(models.CheckRun.device_id == dev_uuid).order_by(models.CheckRun.timestamp.desc()).first()
    prev_failed_rules = set()
    if prev_run:
        prev_failed_rules = {f.rule_name for f in prev_run.findings}

    # Save CheckRun
    check_run = models.CheckRun(
        id=checkrun_in.id,
        device_id=dev_uuid,
        timestamp=checkrun_in.timestamp,
        status=checkrun_in.status,
        score=checkrun_in.score
    )
    db.add(check_run)

    new_failed_rules = set()
    for f_in in checkrun_in.findings:
        finding = models.Finding(
            id=uuid.uuid4(),
            check_run_id=check_run.id,
            rule_name=f_in.rule_name,
            status=f_in.status,
            message=f_in.message,
            severity=f_in.severity
        )
        db.add(finding)
        new_failed_rules.add(f_in.rule_name)

    # Process events based on diffs
    all_monitored_rules = prev_failed_rules.union(new_failed_rules)
    for rule in all_monitored_rules:
        if rule in new_failed_rules and rule not in prev_failed_rules:
            # Trigger Event
            event_msg = f"Violation triggered: {rule.capitalize()} policy failed."
            event = models.Event(
                device_id=dev_uuid,
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
                device_id=dev_uuid,
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

# Dashboard APIs (Requires auth)
@router.get("/devices", response_model=List[schemas.DeviceResponse])
def list_devices(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Update offline states based on check-in timeouts (> 2 minutes means OFFLINE for MVP checkups)
    timeout_threshold = datetime.utcnow() - timedelta(minutes=2)
    offline_devices = db.query(models.Device).filter(
        models.Device.last_checkin < timeout_threshold,
        models.Device.status != "OFFLINE"
    ).all()
    for dev in offline_devices:
        dev.status = "OFFLINE"
    if offline_devices:
        db.commit()

    return db.query(models.Device).filter(models.Device.company_id == current_user.company_id).all()

@router.get("/devices/{id}", response_model=schemas.DeviceResponse)
def get_device(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.company_id == current_user.company_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.get("/devices/{id}/latest-run", response_model=Optional[schemas.CheckRunResponse])
def get_device_latest_run(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.company_id == current_user.company_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    run = db.query(models.CheckRun).filter(models.CheckRun.device_id == id).order_by(models.CheckRun.timestamp.desc()).first()
    return run

@router.get("/devices/{id}/history", response_model=List[schemas.EventResponse])
def get_device_history(id: uuid.UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    device = db.query(models.Device).filter(models.Device.id == id, models.Device.company_id == current_user.company_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return db.query(models.Event).filter(models.Event.device_id == id).order_by(models.Event.timestamp.desc()).all()

@router.get("/policies", response_model=schemas.PolicyResponse)
def get_policies(db: Session = Depends(get_db)):
    # Returns first active policy or generates default
    policy = db.query(models.Policy).filter(models.Policy.is_active == True).first()
    if not policy:
        company = get_default_company(db)
        default_rules = {
            "checks": {
                "firewall": {"enabled": True, "required": True, "severity": "HIGH"},
                "encryption": {"enabled": True, "required": True, "severity": "HIGH"},
                "ssh": {"enabled": True, "required": False, "severity": "MEDIUM"},
                "updates": {"enabled": True, "required": True, "severity": "MEDIUM"},
                "node": {"enabled": True, "required": True, "minimum": "22.0.0", "severity": "MEDIUM"},
                "docker": {"enabled": True, "required": False, "minimum": "20.0.0", "severity": "LOW"}
            }
        }
        policy = models.Policy(
            company_id=company.id,
            rules_yaml=yaml.dump(default_rules),
            is_active=True
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy

@router.post("/policies", response_model=schemas.PolicyResponse)
def update_policies(policy_in: schemas.PolicyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify input is valid YAML
    try:
        yaml.safe_load(policy_in.rules_yaml)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML content: {str(e)}")

    # Deactivate current active policies
    db.query(models.Policy).filter(
        models.Policy.company_id == current_user.company_id,
        models.Policy.is_active == True
    ).update({"is_active": False})

    new_policy = models.Policy(
        company_id=current_user.company_id,
        rules_yaml=policy_in.rules_yaml,
        is_active=True
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_policy

@router.get("/reports/export")
def export_csv_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    devices = db.query(models.Device).filter(models.Device.company_id == current_user.company_id).all()
    
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
