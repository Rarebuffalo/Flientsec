import hashlib
import json
import uuid
from datetime import datetime, timedelta
import pytest
from app.models import models
from app.core import security
from app.services import compliance_service


def create_tenant(db, name="Compliance Corp", email_prefix="admin"):
    org = models.Organization(id=uuid.uuid4(), name=name)
    db.add(org)
    user_email = f"{email_prefix}_{uuid.uuid4().hex[:6]}@flientsec.local"
    user = models.User(
        id=uuid.uuid4(),
        email=user_email,
        hashed_password=security.get_password_hash("password123")
    )
    db.add(user)
    db.commit()

    member = models.Member(
        id=uuid.uuid4(),
        user_id=user.id,
        organization_id=org.id,
        role="owner"
    )
    db.add(member)
    db.commit()

    token = security.create_access_token(subject=user.email)
    headers = {"Authorization": f"Bearer {token}"}
    return org, user, headers


def test_empty_organization_compliance_summary(client, db):
    """Verify an empty organization with 0 devices returns a 100% score and 0 counts without error."""
    org, user, headers = create_tenant(db, name="Empty Org", email_prefix="empty")

    res = client.get("/api/v1/compliance/summary", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["overall_score"] == 100
    assert data["devices"]["total"] == 0
    assert data["devices"]["compliant"] == 0
    assert data["devices"]["failing"] == 0
    assert data["devices"]["unknown"] == 0
    assert data["critical_failures"] == 0
    assert data["stale_devices"] == 0


def test_compliance_controls_listing_and_detail(client, db):
    """Verify standard controls listing and individual control detail endpoints."""
    org, user, headers = create_tenant(db, name="Controls Org", email_prefix="controls")

    # 1. GET /api/v1/compliance/controls
    res = client.get("/api/v1/compliance/controls", headers=headers)
    assert res.status_code == 200, res.text
    controls = res.json()
    assert len(controls) >= 4

    control_ids = [c["control_id"] for c in controls]
    assert "FLIENT-001" in control_ids
    assert "FLIENT-002" in control_ids
    assert "FLIENT-003" in control_ids
    assert "FLIENT-004" in control_ids

    # 2. GET /api/v1/compliance/controls/FLIENT-001
    detail_res = client.get("/api/v1/compliance/controls/FLIENT-001", headers=headers)
    assert detail_res.status_code == 200, detail_res.text
    detail = detail_res.json()
    assert detail["control"]["control_id"] == "FLIENT-001"
    assert "Firewall" in detail["control"]["name"]
    assert detail["posture"]["control_id"] == "FLIENT-001"
    assert "failing_devices" in detail


def test_evidence_creation_hashing_and_immutability(client, db):
    """Verify evidence creation on check-in, deterministic SHA-256 hashing, and immutability."""
    org, user, headers = create_tenant(db, name="Evidence Org", email_prefix="evidence")

    # 1. Setup policy with 2 rules
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Evidence Test Policy")
    db.add(policy)
    db.commit()

    rules_def = {
        "schema_version": 1,
        "metadata": {"name": "Evidence Policy"},
        "rules": [
            {
                "id": "workstation.firewall.enabled",
                "check": "firewall.enabled",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            },
            {
                "id": "workstation.disk.encrypted",
                "check": "disk.root_encrypted",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            }
        ]
    }
    content_str = json.dumps(rules_def)
    content_hash = f"sha256:{hashlib.sha256(content_str.encode('utf-8')).hexdigest()}"

    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=content_str,
        content=content_str,
        content_hash=content_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    # Assign policy to org
    assignment = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(assignment)

    # 2. Register Device
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="macbook-audit-01",
        os_name="Darwin",
        os_version="14.2",
        os_arch="arm64",
        kernel_version="23.2.0",
        agent_version="1.0.0",
        device_token="dev_tok_" + uuid.uuid4().hex[:12]
    )
    db.add(device)
    db.commit()

    # 3. Agent Check-In: 1 rule passes (disk), 1 rule fails (firewall)
    checkrun_id = uuid.uuid4()
    now_iso = datetime.utcnow().isoformat()
    checkin_payload = {
        "id": str(checkrun_id),
        "status": "FAIL",
        "score": 50,
        "timestamp": now_iso,
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "findings": [
            {
                "check_name": "firewall.enabled",
                "rule_id": "workstation.firewall.enabled",
                "severity": "high",
                "status": "fail",
                "reason": "Host firewall daemon is inactive."
            }
        ]
    }

    checkin_headers = {
        "device-uuid": str(device.id),
        "x-device-token": device.device_token
    }

    res = client.post("/api/v1/agent/checkin", json=checkin_payload, headers=checkin_headers)
    assert res.status_code == 200, res.text

    # 4. Verify Evidence records created in database
    evidence_list = (
        db.query(models.Evidence)
        .filter(models.Evidence.device_id == device.id)
        .all()
    )
    assert len(evidence_list) == 2

    # Check FAIL evidence (Firewall)
    fw_ev = next(e for e in evidence_list if e.rule_id == "workstation.firewall.enabled")
    assert fw_ev.status == "FAIL"
    assert fw_ev.control_id == "FLIENT-001"
    assert fw_ev.severity == "HIGH"
    assert "inactive" in fw_ev.observed_result
    assert compliance_service.verify_evidence_integrity(fw_ev) is True

    # Check PASS evidence (Disk)
    disk_ev = next(e for e in evidence_list if e.rule_id == "workstation.disk.encrypted")
    assert disk_ev.status == "PASS"
    assert disk_ev.control_id == "FLIENT-002"
    assert disk_ev.severity == "HIGH"
    assert compliance_service.verify_evidence_integrity(disk_ev) is True

    # 5. Verify Immutability: Mutating an existing Evidence record must raise ValueError
    with pytest.raises(ValueError, match="strictly immutable"):
        fw_ev.status = "PASS"

    # 6. Verify Device Compliance endpoint
    dev_comp_res = client.get(f"/api/v1/devices/{device.id}/compliance", headers=headers)
    assert dev_comp_res.status_code == 200
    dev_comp = dev_comp_res.json()
    assert dev_comp["compliance_score"] == 50
    assert dev_comp["compliance_status"] == "FAIL"
    assert len(dev_comp["controls"]) >= 4

    fw_ctrl = next(c for c in dev_comp["controls"] if c["control_id"] == "FLIENT-001")
    assert fw_ctrl["status"] == "FAIL"
    disk_ctrl = next(c for c in dev_comp["controls"] if c["control_id"] == "FLIENT-002")
    assert disk_ctrl["status"] == "PASS"

    # 7. Verify Device Evidence endpoint
    dev_ev_res = client.get(f"/api/v1/devices/{device.id}/evidence", headers=headers)
    assert dev_ev_res.status_code == 200
    dev_ev_data = dev_ev_res.json()
    assert dev_ev_data["total"] == 2
    assert len(dev_ev_data["items"]) == 2

    # 8. Verify Fleet Evidence feed endpoint
    fleet_ev_res = client.get("/api/v1/compliance/evidence?status=FAIL", headers=headers)
    assert fleet_ev_res.status_code == 200
    fleet_ev = fleet_ev_res.json()
    assert fleet_ev["total"] >= 1
    assert all(item["status"] == "FAIL" for item in fleet_ev["items"])


def test_stale_and_unknown_device_handling(client, db):
    """Verify devices that have never checked in or are older than 1h are classified as UNKNOWN and STALE."""
    org, user, headers = create_tenant(db, name="Stale Org", email_prefix="stale")

    # Device 1: Never checked in
    dev_unknown = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="unregistered-pc",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        compliance_status="UNKNOWN",
        compliance_score=100,
        last_checkin=None
    )
    db.add(dev_unknown)

    # Device 2: Checked in 3 hours ago (STALE)
    stale_time = datetime.utcnow() - timedelta(hours=3)
    dev_stale = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="stale-workstation",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        compliance_status="PASS",
        compliance_score=100,
        last_checkin=stale_time
    )
    db.add(dev_stale)
    db.commit()

    # Query Compliance Summary
    res = client.get("/api/v1/compliance/summary", headers=headers)
    assert res.status_code == 200
    summary = res.json()

    assert summary["devices"]["total"] == 2
    assert summary["devices"]["unknown"] == 2
    assert summary["devices"]["compliant"] == 0
    assert summary["stale_devices"] == 2
    assert summary["overall_score"] == 0  # Missing telemetry cannot contribute compliant score

    # Query Device Compliance for stale device -> status must be UNKNOWN
    dev_res = client.get(f"/api/v1/devices/{dev_stale.id}/compliance", headers=headers)
    assert dev_res.status_code == 200
    dev_data = dev_res.json()
    assert dev_data["compliance_status"] == "UNKNOWN"
    assert dev_data["compliance_score"] == 0


def test_compliance_multi_tenant_isolation(client, db):
    """Verify strict tenant isolation across compliance summary, controls, devices, and evidence."""
    org_a, user_a, headers_a = create_tenant(db, name="Tenant Alpha", email_prefix="alpha")
    org_b, user_b, headers_b = create_tenant(db, name="Tenant Beta", email_prefix="beta")

    # Create device and evidence in Org B
    dev_b = models.Device(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        hostname="beta-server",
        os_name="Linux",
        os_version="Ubuntu 24.04",
        os_arch="x86_64",
        kernel_version="6.8.0",
        agent_version="1.0.0",
        compliance_status="PASS",
        compliance_score=100,
        last_checkin=datetime.utcnow()
    )
    db.add(dev_b)
    db.commit()

    ev_b = models.Evidence(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        device_id=dev_b.id,
        control_id="FLIENT-001",
        rule_id="workstation.firewall.enabled",
        status="PASS",
        severity="HIGH",
        observed_result='{"compliant": true}',
        evaluation_timestamp=datetime.utcnow(),
        evidence_hash="test_hash_b_123",
        created_at=datetime.utcnow()
    )
    db.add(ev_b)
    db.commit()

    # User A tries to access Org B's device compliance -> 404
    res_comp = client.get(f"/api/v1/devices/{dev_b.id}/compliance", headers=headers_a)
    assert res_comp.status_code == 404

    # User A tries to access Org B's device evidence -> 404
    res_ev = client.get(f"/api/v1/devices/{dev_b.id}/evidence", headers=headers_a)
    assert res_ev.status_code == 404

    # User A fleet evidence feed must NOT contain Org B's evidence
    res_feed = client.get("/api/v1/compliance/evidence", headers=headers_a)
    assert res_feed.status_code == 200
    feed_data = res_feed.json()
    assert all(item["organization_id"] == str(org_a.id) for item in feed_data["items"])


def test_policy_rollback_evidence_lifecycle(client, db):
    """
    Scenario:
    Policy v1 active -> v2 active -> device evaluated -> evidence created ->
    rollback to v1 -> device evaluated again -> new evidence created ->
    historical evidence remains completely intact and immutable.
    """
    org, user, headers = create_tenant(db, name="Rollback Evidence Org", email_prefix="rb_ev")

    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Rollback Evidence Policy")
    db.add(policy)
    db.commit()

    # Version 1 (1 rule: firewall)
    v1_rules = {
        "schema_version": 1,
        "metadata": {"name": "v1"},
        "rules": [
            {
                "id": "workstation.firewall.enabled",
                "check": "firewall.enabled",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            }
        ]
    }
    v1_content = json.dumps(v1_rules)
    v1_hash = f"sha256:{hashlib.sha256(v1_content.encode('utf-8')).hexdigest()}"
    v1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=v1_content,
        content=v1_content,
        content_hash=v1_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v1)
    db.commit()

    # Version 2 (2 rules: firewall + disk)
    v2_rules = {
        "schema_version": 1,
        "metadata": {"name": "v2"},
        "rules": [
            {
                "id": "workstation.firewall.enabled",
                "check": "firewall.enabled",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            },
            {
                "id": "workstation.disk.encrypted",
                "check": "disk.root_encrypted",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            }
        ]
    }
    v2_content = json.dumps(v2_rules)
    v2_hash = f"sha256:{hashlib.sha256(v2_content.encode('utf-8')).hexdigest()}"
    v2 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=2,
        definition_json=v2_content,
        content=v2_content,
        content_hash=v2_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v2)
    db.commit()

    policy.active_version_id = v2.id
    db.commit()

    assignment = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(assignment)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="convergence-host",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_" + uuid.uuid4().hex[:12]
    )
    db.add(device)
    db.commit()

    # Step 1: Check-in against v2
    checkrun_1_id = uuid.uuid4()
    client.post(
        "/api/v1/agent/checkin",
        json={
            "id": str(checkrun_1_id),
            "status": "PASS",
            "score": 100,
            "timestamp": datetime.utcnow().isoformat(),
            "policy_version_id": str(v2.id),
            "content_hash": v2_hash,
            "findings": []
        },
        headers={"device-uuid": str(device.id), "x-device-token": device.device_token}
    )

    ev_v2 = (
        db.query(models.Evidence)
        .filter(models.Evidence.device_id == device.id)
        .all()
    )
    assert len(ev_v2) == 2  # 2 rules evaluated in v2
    v2_ev_ids = {e.id for e in ev_v2}

    # Step 2: Rollback to v1
    rollback_res = client.post(
        f"/api/v1/policies/{policy.id}/rollback?target_version_id={v1.id}",
        headers=headers
    )
    assert rollback_res.status_code == 200

    # Step 3: Check-in against rolled-back v1
    checkrun_2_id = uuid.uuid4()
    client.post(
        "/api/v1/agent/checkin",
        json={
            "id": str(checkrun_2_id),
            "status": "PASS",
            "score": 100,
            "timestamp": datetime.utcnow().isoformat(),
            "policy_version_id": str(v1.id),
            "content_hash": v1_hash,
            "findings": []
        },
        headers={"device-uuid": str(device.id), "x-device-token": device.device_token}
    )

    ev_all = (
        db.query(models.Evidence)
        .filter(models.Evidence.device_id == device.id)
        .order_by(models.Evidence.evaluation_timestamp.asc())
        .all()
    )
    assert len(ev_all) == 3  # 2 from v2 run + 1 from v1 run

    # Historical v2 evidence records remain untouched
    for ev in ev_all:
        if ev.id in v2_ev_ids:
            assert ev.policy_version_id == v2.id
        else:
            assert ev.policy_version_id == v1.id


def test_evidence_preservation_during_checkrun_retention(client, db):
    """Verify that automated CheckRun retention preserves Evidence records without deleting them."""
    org, user, headers = create_tenant(db, name="Retention Evidence Org", email_prefix="ret_ev")

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="retention-host",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    old_date = datetime.utcnow() - timedelta(days=45)
    expired_run = models.CheckRun(
        id=uuid.uuid4(),
        device_id=device.id,
        timestamp=old_date,
        status="PASS",
        score=100
    )
    db.add(expired_run)
    db.commit()

    ev = models.Evidence(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_id=device.id,
        control_id="FLIENT-001",
        rule_id="workstation.firewall.enabled",
        check_run_id=expired_run.id,
        status="PASS",
        severity="HIGH",
        observed_result='{"compliant": true}',
        evaluation_timestamp=old_date,
        evidence_hash="ret_hash_123",
        created_at=old_date
    )
    db.add(ev)
    db.commit()

    expired_run_id = expired_run.id
    ev_id = ev.id

    # Trigger retention cleanup via API endpoint with 30-day retention
    cleanup_resp = client.post("/api/v1/maintenance/cleanup-checkruns?retention_days=30", headers=headers)
    assert cleanup_resp.status_code == 200
    assert cleanup_resp.json()["deleted_count"] >= 1

    # CheckRun is deleted
    assert db.query(models.CheckRun).filter(models.CheckRun.id == expired_run_id).first() is None

    # Evidence record is PRESERVED
    preserved_ev = db.query(models.Evidence).filter(models.Evidence.id == ev_id).first()
    assert preserved_ev is not None
    assert preserved_ev.status == "PASS"
    assert preserved_ev.evidence_hash == "ret_hash_123"
    assert preserved_ev.check_run_id is None
