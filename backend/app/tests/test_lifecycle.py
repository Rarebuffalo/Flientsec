import uuid
import json
import hashlib
from datetime import datetime, timedelta
from app.models import models
from app.core import security


def create_tenant(db, name="Tenant Corp", email_prefix="admin"):
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


def test_1_failing_workstation_lifecycle(client, db):
    # 1. Setup Tenant
    org, user, headers = create_tenant(db, name="Acme Security", email_prefix="acme")

    # 2. Create Policy
    policy = models.Policy(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Acme Baseline Policy"
    )
    db.add(policy)
    db.commit()

    # 3. Create Policy Version v1
    v1_rules = {
        "schema_version": 1,
        "metadata": {"name": "Acme Baseline v1"},
        "rules": [
            {
                "id": "workstation.firewall.enabled",
                "check": "firewall.enabled",
                "description": "Host firewall must be enabled",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            },
            {
                "id": "workstation.disk.encrypted",
                "check": "disk.root_encrypted",
                "description": "Disk encryption required",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            }
        ]
    }
    v1_content = (
        "schema_version: 1\n"
        "metadata:\n  name: Acme Baseline v1\n"
        "rules:\n"
        "  - id: workstation.firewall.enabled\n"
        "    check: firewall.enabled\n"
        "    description: Host firewall must be enabled\n"
        "    severity: HIGH\n"
        "    operator: equals\n"
        "    expected: true\n"
        "  - id: workstation.disk.encrypted\n"
        "    check: disk.root_encrypted\n"
        "    description: Disk encryption required\n"
        "    severity: HIGH\n"
        "    operator: equals\n"
        "    expected: true\n"
    )
    v1_hash = f"sha256:{hashlib.sha256(v1_content.encode('utf-8')).hexdigest()}"

    v1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=json.dumps(v1_rules),
        content=v1_content,
        content_hash=v1_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v1)
    db.commit()

    policy.active_version_id = v1.id
    db.commit()

    # Create Org Default Policy Assignment
    assignment = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(assignment)
    db.commit()

    # 4. Enroll / Register Device
    device_id = uuid.uuid4()
    dev_token = "dev_tok_lifecycle_1"
    device = models.Device(
        id=device_id,
        organization_id=org.id,
        hostname="Workstation-Alpha",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="5.15.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="UNKNOWN",
        compliance_score=100,
        device_token=dev_token,
        last_checkin=datetime.utcnow()
    )
    db.add(device)
    db.commit()

    # 5. Submit Check-in with Failing Rule
    checkrun_id = uuid.uuid4()
    checkin_payload = {
        "id": str(checkrun_id),
        "status": "FAIL",
        "score": 60,
        "timestamp": datetime.utcnow().isoformat(),
        "policy_version_id": str(v1.id),
        "content_hash": v1_hash,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Host firewall must be enabled",
                "severity": "HIGH"
            }
        ]
    }
    agent_headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": dev_token
    }
    resp = client.post("/api/v1/agent/checkin", json=checkin_payload, headers=agent_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "FAIL"
    assert resp.json()["score"] == 60
    assert resp.json()["provenance_status"] == "CURRENT"

    # 6. Verify Database State
    db.refresh(device)
    assert device.status == "ONLINE"
    assert device.compliance_status == "FAIL"
    assert device.compliance_score == 60

    # Verify Finding Record
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "workstation.firewall.enabled"
    ).first()
    assert finding is not None
    assert finding.status == "OPEN"
    assert finding.severity == "HIGH"

    # Verify Event Record
    event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.finding_id == finding.id
    ).first()
    assert event is not None
    assert event.type == "VIOLATION_TRIGGERED"
    assert event.policy_version_id == v1.id

    # 7. Query Console-Facing APIs
    dev_resp = client.get(f"/api/v1/devices/{device.id}", headers=headers)
    assert dev_resp.status_code == 200
    assert dev_resp.json()["compliance_status"] == "FAIL"
    assert dev_resp.json()["compliance_score"] == 60

    find_resp = client.get(f"/api/v1/devices/{device.id}/findings", headers=headers)
    assert find_resp.status_code == 200
    assert len(find_resp.json()) == 1
    assert find_resp.json()[0]["rule_id"] == "workstation.firewall.enabled"

    latest_resp = client.get(f"/api/v1/devices/{device.id}/latest-run", headers=headers)
    assert latest_resp.status_code == 200
    assert latest_resp.json()["score"] == 60

    fleet_find_resp = client.get("/api/v1/findings?status=OPEN", headers=headers)
    assert fleet_find_resp.status_code == 200
    assert fleet_find_resp.json()["total"] >= 1

    events_resp = client.get("/api/v1/events?type=VIOLATION_TRIGGERED", headers=headers)
    assert events_resp.status_code == 200
    assert events_resp.json()["total"] >= 1


def test_2_remediation_resolution_lifecycle(client, db):
    # 1. Setup Tenant and failing state
    org, user, headers = create_tenant(db, name="Beta Systems", email_prefix="beta")
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Beta Policy")
    db.add(policy)
    db.commit()

    v1_rules = {
        "schema_version": 1,
        "metadata": {"name": "Beta Baseline v1"},
        "rules": [
            {
                "id": "workstation.firewall.enabled",
                "check": "firewall.enabled",
                "description": "Host firewall required",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            }
        ]
    }
    v1_content = "schema_version: 1\nrules:\n  - id: workstation.firewall.enabled\n"
    v1_hash = f"sha256:{hashlib.sha256(v1_content.encode('utf-8')).hexdigest()}"
    v1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=json.dumps(v1_rules),
        content=v1_content,
        content_hash=v1_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v1)
    db.commit()

    policy.active_version_id = v1.id
    assignment = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(assignment)

    device_id = uuid.uuid4()
    dev_token = "dev_tok_lifecycle_2"
    device = models.Device(
        id=device_id,
        organization_id=org.id,
        hostname="Workstation-Beta",
        os_name="Linux",
        os_version="Debian 12",
        os_arch="x86_64",
        kernel_version="6.1.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="FAIL",
        compliance_score=60,
        device_token=dev_token,
        last_checkin=datetime.utcnow()
    )
    db.add(device)

    # Initial Open Finding
    initial_finding = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        policy_id=policy.id,
        rule_id="workstation.firewall.enabled",
        check_name="firewall.enabled",
        severity="HIGH",
        status="OPEN",
        first_detected_at=datetime.utcnow() - timedelta(hours=1),
        last_detected_at=datetime.utcnow() - timedelta(hours=1)
    )
    db.add(initial_finding)
    db.commit()

    agent_headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": dev_token
    }

    # 2. Submit Remediation Check-in (Passing all rules)
    clean_checkrun_id = uuid.uuid4()
    clean_payload = {
        "id": str(clean_checkrun_id),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "policy_version_id": str(v1.id),
        "content_hash": v1_hash,
        "findings": []
    }
    resp = client.post("/api/v1/agent/checkin", json=clean_payload, headers=agent_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "PASS"
    assert resp.json()["score"] == 100

    # 3. Verify Database State
    db.refresh(device)
    assert device.compliance_status == "PASS"
    assert device.compliance_score == 100

    db.refresh(initial_finding)
    assert initial_finding.status == "RESOLVED"
    assert initial_finding.resolved_at is not None
    assert initial_finding.resolution_reason == "REMEDIATED"

    # Verify VIOLATION_RESOLVED event
    resolve_event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.type == "VIOLATION_RESOLVED",
        models.Event.finding_id == initial_finding.id
    ).first()
    assert resolve_event is not None
    assert resolve_event.policy_version_id == v1.id

    # 4. Verify Console APIs reflect resolved state
    open_resp = client.get("/api/v1/findings?status=OPEN", headers=headers)
    assert open_resp.status_code == 200
    device_open_findings = [f for f in open_resp.json()["items"] if f["device_id"] == str(device.id)]
    assert len(device_open_findings) == 0

    resolved_resp = client.get("/api/v1/findings?status=RESOLVED", headers=headers)
    assert resolved_resp.status_code == 200
    device_resolved = [f for f in resolved_resp.json()["items"] if f["id"] == str(initial_finding.id)]
    assert len(device_resolved) == 1
    assert device_resolved[0]["status"] == "RESOLVED"
    assert device_resolved[0]["resolution_reason"] == "REMEDIATED"


def test_3_continued_failure_and_checkin_idempotency(client, db):
    org, user, headers = create_tenant(db, name="Gamma Corp", email_prefix="gamma")
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Gamma Policy")
    db.add(policy)
    db.commit()

    v1_rules = {
        "schema_version": 1,
        "rules": [{"id": "rule.ssh", "check": "ssh.enabled", "operator": "equals", "expected": False}]
    }
    v1_content = "schema_version: 1\nrules:\n  - id: rule.ssh\n"
    v1_hash = f"sha256:{hashlib.sha256(v1_content.encode('utf-8')).hexdigest()}"
    v1 = models.PolicyVersion(
        id=uuid.uuid4(), policy_id=policy.id, version_number=1,
        definition_json=json.dumps(v1_rules), content=v1_content, content_hash=v1_hash,
        status="PUBLISHED", created_by=user.id
    )
    db.add(v1)
    db.commit()

    policy.active_version_id = v1.id
    assignment = models.PolicyAssignment(
        id=uuid.uuid4(), organization_id=org.id, policy_id=policy.id, device_id=None
    )
    db.add(assignment)

    dev_token = "dev_tok_lifecycle_3"
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Workstation-Gamma",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2.0",
        agent_version="1.0.0", status="ONLINE", compliance_status="UNKNOWN", compliance_score=100,
        device_token=dev_token, last_checkin=datetime.utcnow()
    )
    db.add(device)
    db.commit()

    agent_headers = {"Device-Uuid": str(device.id), "X-Device-Token": dev_token}

    # First failing check-in
    run1_id = uuid.uuid4()
    payload1 = {
        "id": str(run1_id), "status": "FAIL", "score": 80,
        "timestamp": datetime.utcnow().isoformat(),
        "policy_version_id": str(v1.id), "content_hash": v1_hash,
        "findings": [{
            "rule_id": "rule.ssh", "check_name": "ssh.enabled",
            "status": "FAIL", "reason": "SSH active", "severity": "MEDIUM"
        }]
    }
    resp1 = client.post("/api/v1/agent/checkin", json=payload1, headers=agent_headers)
    assert resp1.status_code == 200

    findings_count_1 = db.query(models.Finding).filter(
        models.Finding.device_id == device.id, models.Finding.status == "OPEN"
    ).count()
    events_count_1 = db.query(models.Event).filter(models.Event.device_id == device.id).count()
    assert findings_count_1 == 1
    assert events_count_1 == 1

    # Second check-in with different CheckRun ID but same failure
    run2_id = uuid.uuid4()
    payload2 = {
        "id": str(run2_id), "status": "FAIL", "score": 80,
        "timestamp": (datetime.utcnow() + timedelta(seconds=30)).isoformat(),
        "policy_version_id": str(v1.id), "content_hash": v1_hash,
        "findings": [{
            "rule_id": "rule.ssh", "check_name": "ssh.enabled",
            "status": "FAIL", "reason": "SSH active still", "severity": "MEDIUM"
        }]
    }
    resp2 = client.post("/api/v1/agent/checkin", json=payload2, headers=agent_headers)
    assert resp2.status_code == 200

    # Verify no duplicate open finding was created
    findings_count_2 = db.query(models.Finding).filter(
        models.Finding.device_id == device.id, models.Finding.status == "OPEN"
    ).count()
    events_count_2 = db.query(models.Event).filter(models.Event.device_id == device.id).count()
    assert findings_count_2 == 1
    assert events_count_2 == 1

    # Test Exact CheckRun ID Idempotency
    resp_retry = client.post("/api/v1/agent/checkin", json=payload2, headers=agent_headers)
    assert resp_retry.status_code == 200
    assert resp_retry.json()["id"] == str(run2_id)

    assert db.query(models.CheckRun).filter(models.CheckRun.device_id == device.id).count() == 2
    assert db.query(models.Finding).filter(models.Finding.device_id == device.id).count() == 1


def test_4_policy_change_drift_lifecycle(client, db):
    org, user, headers = create_tenant(db, name="Delta Labs", email_prefix="delta")
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Delta Policy")
    db.add(policy)
    db.commit()

    # Policy v1: only firewall required
    v1_rules = {
        "schema_version": 1,
        "rules": [{"id": "rule.firewall", "check": "firewall.enabled", "operator": "equals", "expected": True}]
    }
    v1_content = "schema_version: 1\nrules:\n  - id: rule.firewall\n"
    v1_hash = f"sha256:{hashlib.sha256(v1_content.encode('utf-8')).hexdigest()}"
    v1 = models.PolicyVersion(
        id=uuid.uuid4(), policy_id=policy.id, version_number=1,
        definition_json=json.dumps(v1_rules), content=v1_content, content_hash=v1_hash,
        status="PUBLISHED", created_by=user.id
    )
    db.add(v1)
    db.commit()

    policy.active_version_id = v1.id
    assignment = models.PolicyAssignment(
        id=uuid.uuid4(), organization_id=org.id, policy_id=policy.id, device_id=None
    )
    db.add(assignment)

    dev_token = "dev_tok_lifecycle_4"
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Workstation-Delta",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.5.0",
        agent_version="1.0.0", status="ONLINE", compliance_status="PASS", compliance_score=100,
        device_token=dev_token, last_checkin=datetime.utcnow()
    )
    db.add(device)
    db.commit()

    agent_headers = {"Device-Uuid": str(device.id), "X-Device-Token": dev_token}

    # Initial check-in under v1 (compliant)
    run1_id = uuid.uuid4()
    payload_v1 = {
        "id": str(run1_id), "status": "PASS", "score": 100,
        "timestamp": (datetime.utcnow() - timedelta(minutes=10)).isoformat(),
        "policy_version_id": str(v1.id), "content_hash": v1_hash,
        "findings": []
    }
    resp1 = client.post("/api/v1/agent/checkin", json=payload_v1, headers=agent_headers)
    assert resp1.status_code == 200

    # Policy v2: adds new rule "rule.node"
    v2_rules = {
        "schema_version": 1,
        "rules": [
            {"id": "rule.firewall", "check": "firewall.enabled", "operator": "equals", "expected": True},
            {"id": "rule.node", "check": "runtime.node.version", "operator": "semver_gte", "expected": "22.0.0"}
        ]
    }
    v2_content = "schema_version: 1\nrules:\n  - id: rule.firewall\n  - id: rule.node\n"
    v2_hash = f"sha256:{hashlib.sha256(v2_content.encode('utf-8')).hexdigest()}"
    v2 = models.PolicyVersion(
        id=uuid.uuid4(), policy_id=policy.id, version_number=2,
        definition_json=json.dumps(v2_rules), content=v2_content, content_hash=v2_hash,
        status="PUBLISHED", created_by=user.id
    )
    db.add(v2)
    db.commit()

    policy.active_version_id = v2.id
    db.commit()

    # Device checks in under v2 and fails "rule.node"
    run2_id = uuid.uuid4()
    payload_v2 = {
        "id": str(run2_id), "status": "FAIL", "score": 80,
        "timestamp": datetime.utcnow().isoformat(),
        "policy_version_id": str(v2.id), "content_hash": v2_hash,
        "findings": [{
            "rule_id": "rule.node",
            "check_name": "runtime.node.version",
            "status": "FAIL",
            "reason": "Node.js below required version",
            "severity": "MEDIUM"
        }]
    }
    resp2 = client.post("/api/v1/agent/checkin", json=payload_v2, headers=agent_headers)
    assert resp2.status_code == 200

    # Verify Finding classification is POLICY_CHANGE_NON_COMPLIANCE
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "rule.node"
    ).first()
    assert finding is not None
    assert finding.drift_type == "POLICY_CHANGE_NON_COMPLIANCE"
    assert finding.status == "OPEN"

    # Verify Event references v2
    event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.finding_id == finding.id
    ).first()
    assert event is not None
    assert event.policy_version_id == v2.id


def test_5_strict_tenant_isolation(client, db):
    # Setup Tenant A
    org_a, user_a, headers_a = create_tenant(db, name="Tenant A Org", email_prefix="tenant_a")
    policy_a = models.Policy(id=uuid.uuid4(), organization_id=org_a.id, name="Policy A")
    db.add(policy_a)
    dev_a = models.Device(
        id=uuid.uuid4(), organization_id=org_a.id, hostname="Device-A",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="5.15",
        agent_version="1.0.0", status="ONLINE", compliance_status="PASS", compliance_score=100,
        device_token="dev_tok_a"
    )
    db.add(dev_a)
    db.commit()

    # Setup Tenant B
    org_b, user_b, headers_b = create_tenant(db, name="Tenant B Org", email_prefix="tenant_b")
    policy_b = models.Policy(id=uuid.uuid4(), organization_id=org_b.id, name="Policy B")
    db.add(policy_b)
    dev_b = models.Device(
        id=uuid.uuid4(), organization_id=org_b.id, hostname="Device-B",
        os_name="Linux", os_version="Debian", os_arch="x86_64", kernel_version="6.1",
        agent_version="1.0.0", status="ONLINE", compliance_status="FAIL", compliance_score=60,
        device_token="dev_tok_b"
    )
    db.add(dev_b)
    finding_b = models.Finding(
        id=uuid.uuid4(), device_id=dev_b.id, policy_id=policy_b.id,
        rule_id="rule.b", check_name="firewall.enabled", severity="HIGH", status="OPEN"
    )
    db.add(finding_b)
    event_b = models.Event(
        id=uuid.uuid4(), device_id=dev_b.id, type="VIOLATION_TRIGGERED",
        rule_name="rule.b", message="Violation triggered on B", finding_id=finding_b.id
    )
    db.add(event_b)
    db.commit()

    # 1. Tenant A direct UUID probing on Tenant B device
    resp = client.get(f"/api/v1/devices/{dev_b.id}", headers=headers_a)
    assert resp.status_code == 404

    resp = client.get(f"/api/v1/devices/{dev_b.id}/latest-run", headers=headers_a)
    assert resp.status_code == 404

    resp = client.get(f"/api/v1/devices/{dev_b.id}/findings", headers=headers_a)
    assert resp.status_code == 404

    resp = client.get(f"/api/v1/devices/{dev_b.id}/history", headers=headers_a)
    assert resp.status_code == 404

    # 2. Tenant A queries fleet findings -> must not contain Tenant B finding
    resp_find = client.get("/api/v1/findings", headers=headers_a)
    assert resp_find.status_code == 200
    b_findings_in_a = [f for f in resp_find.json()["items"] if f["id"] == str(finding_b.id)]
    assert len(b_findings_in_a) == 0

    # 3. Tenant A queries fleet events -> must not contain Tenant B event
    resp_evt = client.get("/api/v1/events", headers=headers_a)
    assert resp_evt.status_code == 200
    b_events_in_a = [e for e in resp_evt.json()["items"] if e["id"] == str(event_b.id)]
    assert len(b_events_in_a) == 0

    # 4. Tenant A direct probing on Tenant B policy
    resp_pol = client.get(f"/api/v1/policies/{policy_b.id}/versions", headers=headers_a)
    assert resp_pol.status_code == 404


def test_6_decommissioned_device_lockout_and_liveness(client, db):
    org, user, headers = create_tenant(db, name="Epsilon Security", email_prefix="eps")
    dev_token = "dev_tok_eps"
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Workstation-Epsilon",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="5.15",
        agent_version="1.0.0", status="ONLINE", compliance_status="PASS", compliance_score=100,
        device_token=dev_token, last_checkin=datetime.utcnow()
    )
    db.add(device)
    db.commit()

    # Decommission device
    revoke_resp = client.post(f"/api/v1/devices/{device.id}/revoke", headers=headers)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "DECOMMISSIONED"

    # Verify agent checkin is locked out (HTTP 403)
    agent_headers = {"Device-Uuid": str(device.id), "X-Device-Token": dev_token}
    checkin_payload = {
        "id": str(uuid.uuid4()), "status": "PASS", "score": 100,
        "timestamp": datetime.utcnow().isoformat(), "findings": []
    }
    check_resp = client.post("/api/v1/agent/checkin", json=checkin_payload, headers=agent_headers)
    assert check_resp.status_code == 403
    assert "decommissioned" in check_resp.json()["detail"].lower()

    # Set last_checkin to 10 days ago
    device.last_checkin = datetime.utcnow() - timedelta(days=10)
    db.commit()

    # Query GET /devices and GET /devices/{id} -> status remains DECOMMISSIONED
    dev_resp = client.get(f"/api/v1/devices/{device.id}", headers=headers)
    assert dev_resp.status_code == 200
    assert dev_resp.json()["status"] == "DECOMMISSIONED"


def test_7_stale_device_liveness(client, db):
    org, user, headers = create_tenant(db, name="Zeta Corp", email_prefix="zeta")
    dev_token = "dev_tok_zeta"

    # Device with last_checkin 5 minutes ago (threshold is 2 minutes)
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Workstation-Zeta",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2",
        agent_version="1.0.0", status="ONLINE", compliance_status="PASS", compliance_score=100,
        device_token=dev_token, last_checkin=datetime.utcnow() - timedelta(minutes=5)
    )
    db.add(device)
    db.commit()

    # Direct query GET /devices/{id} -> evaluates liveness and reports OFFLINE
    direct_resp = client.get(f"/api/v1/devices/{device.id}", headers=headers)
    assert direct_resp.status_code == 200
    assert direct_resp.json()["status"] == "OFFLINE"

    # Fleet query GET /devices -> reports OFFLINE
    fleet_resp = client.get("/api/v1/devices", headers=headers)
    assert fleet_resp.status_code == 200
    matching = [d for d in fleet_resp.json() if d["id"] == str(device.id)]
    assert len(matching) == 1
    assert matching[0]["status"] == "OFFLINE"

    # Heartbeat revives device to ONLINE
    agent_headers = {"Device-Uuid": str(device.id), "X-Device-Token": dev_token}
    hb_resp = client.post("/api/v1/agent/heartbeat", headers=agent_headers)
    assert hb_resp.status_code == 200

    # Now reports ONLINE
    revived_resp = client.get(f"/api/v1/devices/{device.id}", headers=headers)
    assert revived_resp.status_code == 200
    assert revived_resp.json()["status"] == "ONLINE"
