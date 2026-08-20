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


def setup_policy_and_device(db, org, user):
    policy = models.Policy(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Security Baseline Policy"
    )
    db.add(policy)

    raw_yaml = (
        "schema_version: 1\n"
        "metadata:\n  name: Baseline v1\n"
        "rules:\n"
        "  - id: workstation.firewall.enabled\n"
        "    check: firewall.enabled\n"
        "    description: Host firewall must be enabled\n"
        "    severity: HIGH\n"
        "    operator: equals\n"
        "    expected: true\n"
    )
    rules_dict = {
        "schema_version": 1,
        "metadata": {"name": "Baseline v1"},
        "rules": [
            {
                "id": "workstation.firewall.enabled",
                "check": "firewall.enabled",
                "description": "Host firewall must be enabled",
                "severity": "HIGH",
                "operator": "equals",
                "expected": True
            }
        ]
    }
    content_hash = hashlib.sha256(raw_yaml.encode()).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        content=raw_yaml,
        definition_json=json.dumps(rules_dict),
        content_hash=content_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    assignment = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(assignment)
    db.commit()

    dev_token = f"dev_tok_{uuid.uuid4().hex[:12]}"
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="workstation-test-01",
        device_token=dev_token,
        status="ONLINE",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="5.15.0-generic",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    agent_headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": dev_token
    }

    return policy, version, device, agent_headers, content_hash


def test_finding_acknowledgement_lifecycle(client, db):
    org, user, headers = create_tenant(db, name="Ack Corp", email_prefix="ack")
    policy, version, device, agent_headers, content_hash = setup_policy_and_device(db, org, user)

    # 1. Agent reports failing firewall check
    payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Host firewall is disabled or not active"
            }
        ],
        "evidence": [
            {
                "check_name": "firewall.enabled",
                "collected_at": datetime.utcnow().isoformat(),
                "raw_output": "Status: inactive"
            }
        ]
    }
    r = client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=payload
    )
    assert r.status_code == 200

    # Retrieve finding
    findings_res = client.get("/api/v1/findings", headers=headers)
    assert findings_res.status_code == 200
    items = findings_res.json()["items"]
    assert len(items) == 1
    finding_id = items[0]["id"]
    assert items[0]["status"] == "OPEN"

    # 2. Acknowledge Finding
    ack_res = client.post(f"/api/v1/findings/{finding_id}/acknowledge", headers=headers)
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["acknowledged_at"] is not None
    assert ack_data["acknowledged_by_id"] == str(user.id)

    # 3. Verify Event created in DB
    events_res = client.get(f"/api/v1/events?finding_id={finding_id}", headers=headers)
    assert events_res.status_code == 200
    events = events_res.json()["items"]
    event_types = [e["type"] for e in events]
    assert "FINDING_ACKNOWLEDGED" in event_types


def test_finding_remediation_workflow(client, db):
    org, user, headers = create_tenant(db, name="Remediation Corp", email_prefix="rem")
    policy, version, device, agent_headers, content_hash = setup_policy_and_device(db, org, user)

    # Trigger finding
    payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Host firewall inactive"
            }
        ]
    }
    client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=payload
    )

    finding = db.query(models.Finding).filter(models.Finding.device_id == device.id).first()
    assert finding is not None

    # Start Remediation
    rem_res = client.post(
        f"/api/v1/findings/{finding.id}/remediation",
        headers=headers,
        json={"note": "Enabling UFW via Ansible playbook role"}
    )
    assert rem_res.status_code == 200
    rem_data = rem_res.json()
    assert rem_data["status"] == "IN_REMEDIATION"
    assert rem_data["remediation_started_at"] is not None
    assert rem_data["remediation_started_by_id"] == str(user.id)
    assert rem_data["remediation_note"] == "Enabling UFW via Ansible playbook role"

    # Verify event
    events_res = client.get(f"/api/v1/events?finding_id={finding.id}", headers=headers)
    events = events_res.json()["items"]
    assert any(e["type"] == "FINDING_REMEDIATION_STARTED" for e in events)


def test_finding_waiver_workflow_and_validation(client, db):
    org, user, headers = create_tenant(db, name="Waiver Corp", email_prefix="waive")
    policy, version, device, agent_headers, content_hash = setup_policy_and_device(db, org, user)

    # Trigger finding
    payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Firewall disabled"
            }
        ]
    }
    client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=payload
    )
    finding = db.query(models.Finding).filter(models.Finding.device_id == device.id).first()

    # 1. Validation error: empty reason
    future_date = datetime.utcnow() + timedelta(days=14)
    bad_req1 = client.post(
        f"/api/v1/findings/{finding.id}/waive",
        headers=headers,
        json={"reason": "  ", "expires_at": future_date.isoformat()}
    )
    assert bad_req1.status_code == 422

    # 2. Validation error: expiration date in past
    past_date = datetime.utcnow() - timedelta(days=1)
    bad_req2 = client.post(
        f"/api/v1/findings/{finding.id}/waive",
        headers=headers,
        json={"reason": "Legacy server exception", "expires_at": past_date.isoformat()}
    )
    assert bad_req2.status_code == 422

    # 3. Valid waiver
    good_req = client.post(
        f"/api/v1/findings/{finding.id}/waive",
        headers=headers,
        json={
            "reason": "Approved by CISO for legacy database server migration",
            "expires_at": future_date.isoformat(),
            "owner": "devops-lead",
            "ticket_id": "SEC-8091"
        }
    )
    assert good_req.status_code == 200
    data = good_req.json()
    assert data["status"] == "WAIVED"
    assert data["waived_at"] is not None
    assert data["waived_by_id"] == str(user.id)
    assert data["waiver_reason"] == "Approved by CISO for legacy database server migration"
    assert data["waiver_owner"] == "devops-lead"
    assert data["waiver_ticket_id"] == "SEC-8091"


def test_waiver_auto_expiry_on_agent_checkin(client, db):
    org, user, headers = create_tenant(db, name="Expiry Corp", email_prefix="exp")
    policy, version, device, agent_headers, content_hash = setup_policy_and_device(db, org, user)

    # Trigger finding
    payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Firewall disabled"
            }
        ]
    }
    client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=payload
    )

    finding = db.query(models.Finding).filter(models.Finding.device_id == device.id).first()
    # Manually set waiver to an expired timestamp (e.g. 10 minutes in past)
    finding.status = "WAIVED"
    finding.waived_at = datetime.utcnow() - timedelta(days=2)
    finding.waiver_reason = "Temporary test waiver"
    finding.waiver_expires_at = datetime.utcnow() - timedelta(minutes=10)
    db.commit()

    # Next checkin still fails with a new run ID
    payload2 = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Firewall disabled"
            }
        ]
    }
    r = client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=payload2
    )
    assert r.status_code == 200

    # Verify finding automatically transitioned back to OPEN
    db.refresh(finding)
    assert finding.status == "OPEN"

    # Verify FINDING_WAIVER_EXPIRED event created
    events_res = client.get(f"/api/v1/events?finding_id={finding.id}", headers=headers)
    events = events_res.json()["items"]
    assert any(e["type"] == "FINDING_WAIVER_EXPIRED" for e in events)


def test_finding_resolution_evidence_driven(client, db):
    org, user, headers = create_tenant(db, name="Res Corp", email_prefix="res")
    policy, version, device, agent_headers, content_hash = setup_policy_and_device(db, org, user)

    # 1. Failing check-in
    fail_payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Firewall disabled"
            }
        ]
    }
    client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=fail_payload
    )
    finding = db.query(models.Finding).filter(models.Finding.device_id == device.id).first()

    # Move to in-remediation
    client.post(
        f"/api/v1/findings/{finding.id}/remediation",
        headers=headers,
        json={"note": "Configuring ufw"}
    )
    db.refresh(finding)
    assert finding.status == "IN_REMEDIATION"

    # 2. Next check-in passes (zero findings)
    pass_payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "PASS",
        "score": 100,
        "findings": [],
        "evidence": [
            {
                "check_name": "firewall.enabled",
                "collected_at": datetime.utcnow().isoformat(),
                "raw_output": "Status: active"
            }
        ]
    }
    r = client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=pass_payload
    )
    assert r.status_code == 200

    # 3. Verify Finding is RESOLVED with REMEDIATED reason
    db.refresh(finding)
    assert finding.status == "RESOLVED"
    assert finding.resolved_at is not None
    assert finding.resolution_reason == "REMEDIATED"

    # 4. Acknowledging a resolved finding should fail with 400
    bad_ack = client.post(f"/api/v1/findings/{finding.id}/acknowledge", headers=headers)
    assert bad_ack.status_code == 400


def test_finding_detail_and_authoritative_guidance(client, db):
    org, user, headers = create_tenant(db, name="Guidance Corp", email_prefix="gui")
    policy, version, device, agent_headers, content_hash = setup_policy_and_device(db, org, user)

    # Failing check-in
    fail_payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version.id),
        "content_hash": content_hash,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Host firewall inactive"
            }
        ]
    }
    client.post(
        "/api/v1/agent/checkin",
        headers=agent_headers,
        json=fail_payload
    )
    finding = db.query(models.Finding).filter(models.Finding.device_id == device.id).first()

    # Get finding detail
    r = client.get(f"/api/v1/findings/{finding.id}", headers=headers)
    assert r.status_code == 200
    data = r.json()

    assert data["id"] == str(finding.id)
    assert data["rule_id"] == "workstation.firewall.enabled"
    assert data["device_hostname"] == "workstation-test-01"
    assert data["guidance"] is not None
    guidance = data["guidance"]
    assert "Firewall" in guidance["title"]
    assert len(guidance["os_guidance"]) >= 2
    assert any("ufw" in g["remediation_cmd"] for g in guidance["os_guidance"])
    assert any("ufw status" in g["verification_cmd"] for g in guidance["os_guidance"])
    assert "automated_verification_note" in guidance


def test_findings_summary_and_tenant_isolation(client, db):
    # Org A
    org_a, user_a, headers_a = create_tenant(db, name="Org Alpha", email_prefix="alpha")
    policy_a, version_a, device_a, agent_headers_a, hash_a = setup_policy_and_device(db, org_a, user_a)

    # Org B
    org_b, user_b, headers_b = create_tenant(db, name="Org Beta", email_prefix="beta")
    policy_b, version_b, device_b, agent_headers_b, hash_b = setup_policy_and_device(db, org_b, user_b)

    # Trigger finding on Org A
    fail_payload = {
        "id": str(uuid.uuid4()),
        "policy_version_id": str(version_a.id),
        "content_hash": hash_a,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "FAIL",
        "score": 40,
        "findings": [
            {
                "rule_id": "workstation.firewall.enabled",
                "check_name": "firewall.enabled",
                "severity": "HIGH",
                "status": "FAIL",
                "reason": "Host firewall inactive"
            }
        ]
    }
    client.post("/api/v1/agent/checkin", headers=agent_headers_a, json=fail_payload)
    finding_a = db.query(models.Finding).filter(models.Finding.device_id == device_a.id).first()

    # 1. Summary checks for Org A
    sum_a = client.get("/api/v1/findings/summary", headers=headers_a).json()
    assert sum_a["open_count"] == 1
    assert sum_a["critical_high_count"] == 1
    assert sum_a["total"] == 1

    # Summary for Org B should be 0
    sum_b = client.get("/api/v1/findings/summary", headers=headers_b).json()
    assert sum_b["open_count"] == 0
    assert sum_b["total"] == 0

    # 2. Tenant isolation: Org B user cannot access Org A finding
    r404 = client.get(f"/api/v1/findings/{finding_a.id}", headers=headers_b)
    assert r404.status_code == 404

    r404_ack = client.post(f"/api/v1/findings/{finding_a.id}/acknowledge", headers=headers_b)
    assert r404_ack.status_code == 404

    r404_rem = client.post(f"/api/v1/findings/{finding_a.id}/remediation", headers=headers_b, json={"note": "x"})
    assert r404_rem.status_code == 404

    r404_waive = client.post(
        f"/api/v1/findings/{finding_a.id}/waive",
        headers=headers_b,
        json={"reason": "test", "expires_at": (datetime.utcnow() + timedelta(days=1)).isoformat()}
    )
    assert r404_waive.status_code == 404
