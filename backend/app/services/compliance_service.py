import hashlib
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.models import models


# Standard baseline control mapping
DEFAULT_CONTROLS_DATA = [
    {
        "control_id": "FLIENT-001",
        "name": "Host Firewall Enabled",
        "description": "Ensure the host firewall daemon (UFW/iptables/pf) is active and running.",
        "category": "Endpoint Security",
        "severity": "HIGH",
        "mapped_rule_id": "workstation.firewall.enabled",
        "alternate_rules": ["firewall.enabled", "workstation.firewall.enabled"]
    },
    {
        "control_id": "FLIENT-002",
        "name": "Disk Encryption Enabled",
        "description": "Ensure the workstation root filesystem is encrypted with LUKS/dm-crypt.",
        "category": "Data Protection",
        "severity": "HIGH",
        "mapped_rule_id": "workstation.disk.encrypted",
        "alternate_rules": ["disk.root_encrypted", "workstation.disk.encrypted"]
    },
    {
        "control_id": "FLIENT-003",
        "name": "Screen Lock & Idle Lockout",
        "description": "Ensure automatic screen lock and screensaver idle lockout is active.",
        "category": "Access Control",
        "severity": "MEDIUM",
        "mapped_rule_id": "workstation.screen.lock",
        "alternate_rules": ["screen.lock_enabled", "workstation.screen.lock"]
    },
    {
        "control_id": "FLIENT-004",
        "name": "Supported Operating System",
        "description": "Ensure device is running an approved and supported OS distribution version.",
        "category": "System Integrity",
        "severity": "LOW",
        "mapped_rule_id": "workstation.os.version",
        "alternate_rules": ["os.version", "workstation.os.version"]
    }
]


def compute_evidence_hash(
    organization_id: str,
    device_id: str,
    control_id: str,
    rule_id: str,
    check_run_id: str,
    status: str,
    evaluation_timestamp: str,
    observed_result: str
) -> str:
    """
    Computes a deterministic SHA-256 integrity hash for an evidence record.
    Canonical string format:
    organization_id|device_id|control_id|rule_id|check_run_id|status|evaluation_timestamp|observed_result
    """
    canonical_str = (
        f"{str(organization_id)}|{str(device_id)}|{str(control_id)}|"
        f"{str(rule_id)}|{str(check_run_id)}|{str(status)}|"
        f"{str(evaluation_timestamp)}|{str(observed_result)}"
    )
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def verify_evidence_integrity(evidence: models.Evidence) -> bool:
    """Verifies that an existing Evidence record matches its cryptographic SHA-256 hash."""
    expected_hash = compute_evidence_hash(
        organization_id=str(evidence.organization_id),
        device_id=str(evidence.device_id),
        control_id=evidence.control_id,
        rule_id=evidence.rule_id,
        check_run_id=str(evidence.check_run_id) if evidence.check_run_id else "",
        status=evidence.status,
        evaluation_timestamp=evidence.evaluation_timestamp.isoformat(),
        observed_result=evidence.observed_result
    )
    return evidence.evidence_hash == expected_hash


def map_rule_to_control(rule_id: str, check_name: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Maps a policy rule_id / check_name to a standard control ID, control name, and default severity.
    Returns: (control_id, control_name, severity)
    """
    clean_rule = rule_id.lower()
    clean_check = (check_name or "").lower()

    for ctrl in DEFAULT_CONTROLS_DATA:
        for pattern in ctrl["alternate_rules"]:
            if pattern.lower() in clean_rule or (clean_check and pattern.lower() in clean_check):
                return ctrl["control_id"], ctrl["name"], ctrl["severity"]

    # Fallback dynamic control for custom company rules
    prefix = clean_rule.replace(".", "-").replace("_", "-").upper()
    return f"CTRL-{prefix[:12]}", f"Policy Rule {rule_id}", "MEDIUM"


def get_or_seed_controls(db: Session, organization_id: Optional[uuid.UUID] = None) -> List[models.ComplianceControl]:
    """Retrieves all registered controls for an organization (including global defaults)."""
    query = db.query(models.ComplianceControl)
    if organization_id:
        controls = query.filter(
            or_(
                models.ComplianceControl.organization_id == organization_id,
                models.ComplianceControl.organization_id.is_(None)
            )
        ).all()
    else:
        controls = query.filter(models.ComplianceControl.organization_id.is_(None)).all()

    if not controls:
        # Seed standard defaults dynamically if database table was empty
        seeded = []
        for ctrl_data in DEFAULT_CONTROLS_DATA:
            ctrl = models.ComplianceControl(
                id=uuid.uuid4(),
                organization_id=organization_id,
                control_id=ctrl_data["control_id"],
                name=ctrl_data["name"],
                description=ctrl_data["description"],
                category=ctrl_data["category"],
                severity=ctrl_data["severity"],
                mapped_rule_id=ctrl_data["mapped_rule_id"]
            )
            db.add(ctrl)
            seeded.append(ctrl)
        db.commit()
        return seeded

    return controls


def generate_evidence_for_checkin(
    db: Session,
    device: models.Device,
    check_run: models.CheckRun,
    policy_version: models.PolicyVersion,
    reported_findings: list
) -> List[models.Evidence]:
    """
    Derives and persists immutable audit Evidence records for all rules evaluated in a CheckRun.
    """
    import json as py_json

    # 1. Parse evaluated rules from active policy definition
    try:
        policy_data = py_json.loads(policy_version.definition_json)
        rules_list = policy_data.get("rules", [])
    except Exception:
        rules_list = []

    evaluated_rules_map = {r.get("id"): r for r in rules_list if r.get("id")}

    # Map reported failures by rule_id
    failed_rules_dict = {}
    for f in reported_findings:
        failed_rules_dict[f.rule_id] = f

    evidence_records = []
    eval_ts = check_run.timestamp or datetime.utcnow()
    eval_ts_iso = eval_ts.isoformat()

    for rule_id, rule_spec in evaluated_rules_map.items():
        check_name = rule_spec.get("check", "")
        control_id, _, default_sev = map_rule_to_control(rule_id, check_name)
        rule_sev = rule_spec.get("severity", default_sev).upper()

        if rule_id in failed_rules_dict:
            # Rule Failed -> Status FAIL
            finding_item = failed_rules_dict[rule_id]
            status = "FAIL"
            obs_dict = {
                "compliant": False,
                "check": check_name,
                "operator": rule_spec.get("operator", "equals"),
                "expected": rule_spec.get("expected"),
                "reason": finding_item.reason,
                "failure_detected_at": eval_ts_iso
            }
        else:
            # Rule Passed -> Status PASS
            status = "PASS"
            obs_dict = {
                "compliant": True,
                "check": check_name,
                "operator": rule_spec.get("operator", "equals"),
                "expected": rule_spec.get("expected"),
                "evaluated_at": eval_ts_iso
            }

        obs_json = py_json.dumps(obs_dict, sort_keys=True, separators=(",", ":"))

        evidence_hash = compute_evidence_hash(
            organization_id=str(device.organization_id),
            device_id=str(device.id),
            control_id=control_id,
            rule_id=rule_id,
            check_run_id=str(check_run.id),
            status=status,
            evaluation_timestamp=eval_ts_iso,
            observed_result=obs_json
        )

        evidence = models.Evidence(
            id=uuid.uuid4(),
            organization_id=device.organization_id,
            device_id=device.id,
            control_id=control_id,
            rule_id=rule_id,
            check_run_id=check_run.id,
            policy_version_id=policy_version.id,
            status=status,
            severity=rule_sev,
            observed_result=obs_json,
            evaluation_timestamp=eval_ts,
            evidence_hash=evidence_hash,
            created_at=datetime.utcnow()
        )
        db.add(evidence)
        evidence_records.append(evidence)

    return evidence_records


def calculate_fleet_compliance_summary(
    db: Session,
    organization_id: uuid.UUID,
    freshness_seconds: int = 3600
) -> Dict:
    """
    Computes authoritative fleet-wide compliance posture summary for an organization.
    Evaluates active devices, control statuses, critical failures, and stale devices.
    """
    now = datetime.utcnow()
    freshness_cutoff = now - timedelta(seconds=freshness_seconds)

    # 1. Fetch active (non-decommissioned) devices
    active_devices = (
        db.query(models.Device)
        .filter(
            models.Device.organization_id == organization_id,
            models.Device.status != "DECOMMISSIONED"
        )
        .all()
    )

    total_devices = len(active_devices)

    if total_devices == 0:
        return {
            "overall_score": 100,
            "devices": {
                "total": 0,
                "compliant": 0,
                "failing": 0,
                "unknown": 0
            },
            "controls": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "unknown": 0
            },
            "critical_failures": 0,
            "stale_devices": 0
        }

    compliant_count = 0
    failing_count = 0
    unknown_count = 0
    stale_count = 0
    scores_sum = 0

    for dev in active_devices:
        is_fresh = dev.last_checkin and (dev.last_checkin >= freshness_cutoff)

        if not dev.last_checkin or not is_fresh:
            unknown_count += 1
            stale_count += 1
            # Missing or stale telemetry contributes 0 to compliance score
            scores_sum += 0
        elif dev.compliance_status == "PASS":
            compliant_count += 1
            scores_sum += (dev.compliance_score if dev.compliance_score is not None else 100)
        else:
            failing_count += 1
            scores_sum += (dev.compliance_score if dev.compliance_score is not None else 0)

    overall_score = int(round(scores_sum / total_devices)) if total_devices > 0 else 100

    # 2. Controls Breakdown across fleet
    controls = get_or_seed_controls(db, organization_id)
    passed_controls_count = 0
    failed_controls_count = 0
    unknown_controls_count = 0

    for ctrl in controls:
        posture = get_single_control_posture(db, organization_id, ctrl, active_devices, freshness_cutoff)
        if posture["status"] == "PASS":
            passed_controls_count += 1
        elif posture["status"] == "FAIL":
            failed_controls_count += 1
        else:
            unknown_controls_count += 1

    # 3. Critical Failures (Open High/Critical severity findings)
    critical_failures_count = (
        db.query(models.Finding)
        .join(models.Device, models.Finding.device_id == models.Device.id)
        .filter(
            models.Device.organization_id == organization_id,
            models.Device.status != "DECOMMISSIONED",
            models.Finding.status == "OPEN",
            models.Finding.severity.in_(["high", "critical", "HIGH", "CRITICAL"])
        )
        .count()
    )

    return {
        "overall_score": overall_score,
        "devices": {
            "total": total_devices,
            "compliant": compliant_count,
            "failing": failing_count,
            "unknown": unknown_count
        },
        "controls": {
            "total": len(controls),
            "passed": passed_controls_count,
            "failed": failed_controls_count,
            "unknown": unknown_controls_count
        },
        "critical_failures": critical_failures_count,
        "stale_devices": stale_count
    }


def get_single_control_posture(
    db: Session,
    organization_id: uuid.UUID,
    control: models.ComplianceControl,
    active_devices: List[models.Device],
    freshness_cutoff: datetime
) -> Dict:
    """Computes posture metrics for a single compliance control."""
    total_devices = len(active_devices)
    if total_devices == 0:
        return {
            "control_id": control.control_id,
            "name": control.name,
            "description": control.description,
            "category": control.category,
            "severity": control.severity,
            "mapped_rule_id": control.mapped_rule_id,
            "status": "NOT_APPLICABLE",
            "compliance_percentage": 100,
            "passed_devices": 0,
            "failed_devices": 0,
            "unknown_devices": 0
        }

    # Query latest evidence for this control per device
    passed_devs = 0
    failed_devs = 0
    unknown_devs = 0

    for dev in active_devices:
        is_fresh = dev.last_checkin and (dev.last_checkin >= freshness_cutoff)
        if not is_fresh:
            unknown_devs += 1
            continue

        # Get latest evidence record for this device & control
        latest_ev = (
            db.query(models.Evidence)
            .filter(
                models.Evidence.organization_id == organization_id,
                models.Evidence.device_id == dev.id,
                models.Evidence.control_id == control.control_id
            )
            .order_by(desc(models.Evidence.evaluation_timestamp))
            .first()
        )

        if not latest_ev:
            # Check if there is an active open finding matching mapped rule
            has_finding = (
                db.query(models.Finding)
                .filter(
                    models.Finding.device_id == dev.id,
                    models.Finding.status == "OPEN",
                    or_(
                        models.Finding.rule_id == control.mapped_rule_id,
                        models.Finding.check_name == control.mapped_rule_id
                    )
                )
                .first()
            )
            if has_finding:
                failed_devs += 1
            else:
                unknown_devs += 1
        elif latest_ev.status == "PASS":
            passed_devs += 1
        elif latest_ev.status == "FAIL":
            failed_devs += 1
        else:
            unknown_devs += 1

    evaluated_devs = passed_devs + failed_devs
    if evaluated_devs > 0:
        pct = int(round((passed_devs / evaluated_devs) * 100))
    elif total_devices > 0:
        pct = 0
    else:
        pct = 100

    if failed_devs > 0:
        status = "FAIL"
    elif passed_devs > 0 and unknown_devs == 0:
        status = "PASS"
    elif passed_devs > 0 and unknown_devs > 0:
        status = "PASS" if pct >= 80 else "FAIL"
    else:
        status = "UNKNOWN"

    return {
        "control_id": control.control_id,
        "name": control.name,
        "description": control.description,
        "category": control.category,
        "severity": control.severity,
        "mapped_rule_id": control.mapped_rule_id,
        "status": status,
        "compliance_percentage": pct,
        "passed_devices": passed_devs,
        "failed_devices": failed_devs,
        "unknown_devices": unknown_devs
    }


def get_compliance_controls_posture(
    db: Session,
    organization_id: uuid.UUID,
    freshness_seconds: int = 3600
) -> List[Dict]:
    """Retrieves all controls with fleet posture statistics."""
    now = datetime.utcnow()
    freshness_cutoff = now - timedelta(seconds=freshness_seconds)

    active_devices = (
        db.query(models.Device)
        .filter(
            models.Device.organization_id == organization_id,
            models.Device.status != "DECOMMISSIONED"
        )
        .all()
    )

    controls = get_or_seed_controls(db, organization_id)
    result = []
    for ctrl in controls:
        result.append(
            get_single_control_posture(db, organization_id, ctrl, active_devices, freshness_cutoff)
        )
    return result


def get_control_detail(
    db: Session,
    organization_id: uuid.UUID,
    control_id: str,
    freshness_seconds: int = 3600
) -> Optional[Dict]:
    """Returns control detail, posture, and list of devices failing this control."""
    control = (
        db.query(models.ComplianceControl)
        .filter(
            models.ComplianceControl.control_id == control_id,
            or_(
                models.ComplianceControl.organization_id == organization_id,
                models.ComplianceControl.organization_id.is_(None)
            )
        )
        .first()
    )
    if not control:
        return None

    now = datetime.utcnow()
    freshness_cutoff = now - timedelta(seconds=freshness_seconds)

    active_devices = (
        db.query(models.Device)
        .filter(
            models.Device.organization_id == organization_id,
            models.Device.status != "DECOMMISSIONED"
        )
        .all()
    )

    posture = get_single_control_posture(db, organization_id, control, active_devices, freshness_cutoff)

    # Collect failing devices
    failing_devices = []
    for dev in active_devices:
        latest_ev = (
            db.query(models.Evidence)
            .filter(
                models.Evidence.organization_id == organization_id,
                models.Evidence.device_id == dev.id,
                models.Evidence.control_id == control.control_id
            )
            .order_by(desc(models.Evidence.evaluation_timestamp))
            .first()
        )
        if latest_ev and latest_ev.status == "FAIL":
            failing_devices.append(dev)
        elif not latest_ev:
            has_finding = (
                db.query(models.Finding)
                .filter(
                    models.Finding.device_id == dev.id,
                    models.Finding.status == "OPEN",
                    or_(
                        models.Finding.rule_id == control.mapped_rule_id,
                        models.Finding.check_name == control.mapped_rule_id
                    )
                )
                .first()
            )
            if has_finding:
                failing_devices.append(dev)

    return {
        "control": control,
        "posture": posture,
        "failing_devices": failing_devices
    }


def get_device_compliance_posture(
    db: Session,
    organization_id: uuid.UUID,
    device_id: uuid.UUID,
    freshness_seconds: int = 3600
) -> Optional[Dict]:
    """Computes single-device compliance posture and control checklist."""
    device = (
        db.query(models.Device)
        .filter(
            models.Device.id == device_id,
            models.Device.organization_id == organization_id
        )
        .first()
    )
    if not device:
        return None

    now = datetime.utcnow()
    freshness_cutoff = now - timedelta(seconds=freshness_seconds)
    is_fresh = device.last_checkin and (device.last_checkin >= freshness_cutoff)

    controls = get_or_seed_controls(db, organization_id)
    control_statuses = []

    for ctrl in controls:
        if not is_fresh:
            status = "UNKNOWN"
            obs_res = None
            eval_ts = None
        else:
            latest_ev = (
                db.query(models.Evidence)
                .filter(
                    models.Evidence.organization_id == organization_id,
                    models.Evidence.device_id == device.id,
                    models.Evidence.control_id == ctrl.control_id
                )
                .order_by(desc(models.Evidence.evaluation_timestamp))
                .first()
            )
            if latest_ev:
                status = latest_ev.status
                obs_res = latest_ev.observed_result
                eval_ts = latest_ev.evaluation_timestamp
            else:
                has_finding = (
                    db.query(models.Finding)
                    .filter(
                        models.Finding.device_id == device.id,
                        models.Finding.status == "OPEN",
                        or_(
                            models.Finding.rule_id == ctrl.mapped_rule_id,
                            models.Finding.check_name == ctrl.mapped_rule_id
                        )
                    )
                    .first()
                )
                if has_finding:
                    status = "FAIL"
                    obs_res = has_finding.reason
                    eval_ts = has_finding.last_detected_at
                else:
                    status = "UNKNOWN"
                    obs_res = None
                    eval_ts = None

        control_statuses.append({
            "control_id": ctrl.control_id,
            "name": ctrl.name,
            "severity": ctrl.severity,
            "status": status,
            "rule_id": ctrl.mapped_rule_id,
            "observed_result": obs_res,
            "last_evaluated_at": eval_ts
        })

    effective_score = device.compliance_score if (is_fresh and device.compliance_score is not None) else 0
    effective_status = device.compliance_status if is_fresh else "UNKNOWN"

    return {
        "device_id": device.id,
        "hostname": device.hostname,
        "compliance_score": effective_score,
        "compliance_status": effective_status,
        "last_checkin": device.last_checkin,
        "controls": control_statuses
    }


def get_device_evidence_history(
    db: Session,
    organization_id: uuid.UUID,
    device_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0
) -> Tuple[int, List[models.Evidence]]:
    """Retrieves paginated historical evidence records for a single device."""
    query = (
        db.query(models.Evidence)
        .filter(
            models.Evidence.organization_id == organization_id,
            models.Evidence.device_id == device_id
        )
        .order_by(desc(models.Evidence.evaluation_timestamp))
    )
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return total, items


def get_fleet_evidence_feed(
    db: Session,
    organization_id: uuid.UUID,
    control_id: Optional[str] = None,
    status: Optional[str] = None,
    device_id: Optional[uuid.UUID] = None,
    limit: int = 50,
    offset: int = 0
) -> Tuple[int, List[models.Evidence]]:
    """Retrieves paginated fleet-wide evidence feed with optional filters."""
    query = (
        db.query(models.Evidence)
        .filter(models.Evidence.organization_id == organization_id)
    )
    if control_id:
        query = query.filter(models.Evidence.control_id == control_id)
    if status:
        query = query.filter(models.Evidence.status == status.upper())
    if device_id:
        query = query.filter(models.Evidence.device_id == device_id)

    query = query.order_by(desc(models.Evidence.evaluation_timestamp))
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return total, items
