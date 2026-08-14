import hashlib
import json
import urllib.parse
import uuid
from datetime import datetime
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


def test_safe_policy_rollback_lifecycle(client, db):
    """
    Verify complete policy rollback lifecycle:
    v1 active -> v2 published & activated -> rollback to v1.
    Verifies version immutability, audit event recording, and agent synchronization.
    """
    org, user, headers = create_tenant(db, name="Rollback Corp", email_prefix="rollback_admin")

    # 1. Create Policy
    policy = models.Policy(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Rollback Baseline Policy"
    )
    db.add(policy)
    db.commit()

    # 2. Create Policy Version v1
    v1_rules = {
        "schema_version": 1,
        "metadata": {"name": "Baseline v1"},
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
    v1_content = (
        "schema_version: 1\n"
        "metadata:\n  name: Baseline v1\n"
        "rules:\n"
        "  - id: workstation.firewall.enabled\n"
        "    check: firewall.enabled\n"
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

    v1_id = v1.id

    # 3. Create v2 Draft via POST /policies/{id}/versions?rules_json=...
    v2_rules = {
        "schema_version": 1,
        "metadata": {"name": "Baseline v2"},
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
    encoded_v2 = urllib.parse.quote(json.dumps(v2_rules))
    v2_draft_res = client.post(
        f"/api/v1/policies/{policy.id}/versions?rules_json={encoded_v2}",
        headers=headers
    )
    assert v2_draft_res.status_code == 200, v2_draft_res.text
    v2_draft = v2_draft_res.json()
    assert v2_draft["version_number"] == 2
    assert v2_draft["status"] == "DRAFT"

    # 4. Publish v2
    client.post(
        f"/api/v1/policies/{policy.id}/versions/{v2_draft['id']}/publish",
        headers=headers
    )

    # 5. Activate v2
    act_res = client.post(
        f"/api/v1/policies/{policy.id}/activate?version_id={v2_draft['id']}",
        headers=headers
    )
    assert act_res.status_code == 200
    assert act_res.json()["active_version_id"] == v2_draft["id"]
    assert act_res.json()["active_version_number"] == 2

    # 6. Attempt Rollback to a DRAFT (Create a v3 draft first)
    encoded_v3 = urllib.parse.quote(json.dumps({"schema_version": 1, "rules": []}))
    v3_draft_res = client.post(
        f"/api/v1/policies/{policy.id}/versions?rules_json={encoded_v3}",
        headers=headers
    )
    v3_draft = v3_draft_res.json()
    assert v3_draft["status"] == "DRAFT"

    # Rollback to DRAFT must fail with 400
    res_draft_fail = client.post(
        f"/api/v1/policies/{policy.id}/rollback?target_version_id={v3_draft['id']}",
        headers=headers
    )
    assert res_draft_fail.status_code == 400
    assert "draft" in res_draft_fail.json()["detail"].lower()

    # 7. Attempt Rollback to currently active version (v2) -> must fail with 400
    res_active_fail = client.post(
        f"/api/v1/policies/{policy.id}/rollback?target_version_id={v2_draft['id']}",
        headers=headers
    )
    assert res_active_fail.status_code == 400
    assert "already the active version" in res_active_fail.json()["detail"].lower()

    # 8. Execute Rollback to v1
    rollback_res = client.post(
        f"/api/v1/policies/{policy.id}/rollback?target_version_id={v1_id}",
        headers=headers
    )
    assert rollback_res.status_code == 200, rollback_res.text
    rollback_data = rollback_res.json()

    assert rollback_data["status"] == "success"
    assert rollback_data["active_version_id"] == str(v1_id)
    assert rollback_data["active_version_number"] == 1
    assert rollback_data["previous_active_version_id"] == v2_draft["id"]

    # 9. Check Invariants: Historical versions must remain completely immutable
    v1_post = db.query(models.PolicyVersion).filter(models.PolicyVersion.id == v1_id).first()
    assert v1_post.content == v1_content
    assert v1_post.content_hash == v1_hash
    assert v1_post.version_number == 1
    assert v1_post.status == "PUBLISHED"

    v2_post = db.query(models.PolicyVersion).filter(models.PolicyVersion.id == v2_draft["id"]).first()
    assert v2_post.version_number == 2
    assert v2_post.status == "PUBLISHED"

    # 10. Check Rollback Audit Event in Database & Fleet Events API
    audit_event = (
        db.query(models.Event)
        .filter(models.Event.type == "POLICY_ROLLBACK")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert audit_event is not None
    assert audit_event.policy_version_id == uuid.UUID(str(v1_id))
    assert "rolled back from version 2 to version 1" in audit_event.message

    # Verify Activity feed returns the POLICY_ROLLBACK event
    events_res = client.get("/api/v1/events", headers=headers)
    assert events_res.status_code == 200
    fleet_events = events_res.json()["items"]
    rollback_evt = next((e for e in fleet_events if e["type"] == "POLICY_ROLLBACK"), None)
    assert rollback_evt is not None
    assert rollback_evt["policy_version_number"] == 1


def test_rollback_tenant_and_policy_isolation(client, db):
    """Verify Org A cannot rollback Org B's policy or cross-link a different policy's version."""
    org_a, user_a, headers_a = create_tenant(db, name="Tenant A", email_prefix="tenant_a")
    org_b, user_b, headers_b = create_tenant(db, name="Tenant B", email_prefix="tenant_b")

    policy_a = models.Policy(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        name="Policy A"
    )
    db.add(policy_a)
    db.commit()

    ver_a = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy_a.id,
        version_number=1,
        definition_json='{"rules": []}',
        content="name: Policy A\nrules: []",
        status="PUBLISHED",
        created_by=user_a.id
    )
    db.add(ver_a)
    db.commit()

    policy_a.active_version_id = ver_a.id
    db.commit()

    policy_b = models.Policy(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        name="Policy B"
    )
    db.add(policy_b)
    db.commit()

    ver_b = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy_b.id,
        version_number=1,
        definition_json='{"rules": []}',
        content="name: Policy B\nrules: []",
        status="PUBLISHED",
        created_by=user_b.id
    )
    db.add(ver_b)
    db.commit()

    policy_b.active_version_id = ver_b.id
    db.commit()

    # 1. User A tries to rollback Policy B -> 404 (Not found in Org A)
    res1 = client.post(
        f"/api/v1/policies/{policy_b.id}/rollback?target_version_id={ver_b.id}",
        headers=headers_a
    )
    assert res1.status_code == 404

    # 2. User A tries to rollback Policy A with target_version from Policy B -> 400
    res2 = client.post(
        f"/api/v1/policies/{policy_a.id}/rollback?target_version_id={ver_b.id}",
        headers=headers_a
    )
    assert res2.status_code == 400
    assert "does not belong to this policy" in res2.json()["detail"].lower()


def test_agent_policy_sync_after_rollback(client, db):
    """Verify that after rollback, the agent fetches the active rolled-back version with valid hash."""
    org, user, headers = create_tenant(db, name="Agent Sync Org", email_prefix="agent_sync")

    # Policy v1
    v1_content = "schema_version: 1\nrules:\n  - id: firewall.enabled\n"
    v1_hash = f"sha256:{hashlib.sha256(v1_content.encode('utf-8')).hexdigest()}"

    policy = models.Policy(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Agent Baseline Policy"
    )
    db.add(policy)
    db.commit()

    v1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json='{"rules": [{"id": "firewall.enabled"}]}',
        content=v1_content,
        content_hash=v1_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v1)
    db.commit()

    policy.active_version_id = v1.id
    db.commit()

    # Set as org default policy
    assignment = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(assignment)
    db.commit()

    # Register device
    dev_token = "dev_tok_agent_sync_1"
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Sync-Host",
        os_name="Linux",
        os_version="Ubuntu 22.04",
        os_arch="x86_64",
        kernel_version="5.15.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="PASS",
        compliance_score=100,
        device_token=dev_token,
        last_checkin=datetime.utcnow()
    )
    db.add(device)
    db.commit()

    agent_headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": dev_token
    }

    # Fetch initial agent policy (v1)
    res_agent_v1 = client.get("/api/v1/agent/policy", headers=agent_headers)
    assert res_agent_v1.status_code == 200
    data_v1 = res_agent_v1.json()
    assert data_v1["version_number"] == 1
    assert data_v1["content_hash"] == v1_hash

    # Create v2, publish, activate
    v2_content = "schema_version: 1\nrules:\n  - id: firewall.enabled\n  - id: disk.encryption\n"
    v2_hash = f"sha256:{hashlib.sha256(v2_content.encode('utf-8')).hexdigest()}"
    v2 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=2,
        definition_json='{"rules": [{"id": "firewall.enabled"}, {"id": "disk.encryption"}]}',
        content=v2_content,
        content_hash=v2_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v2)
    db.commit()

    policy.active_version_id = v2.id
    db.commit()

    # Agent fetches v2
    res_agent_v2 = client.get("/api/v1/agent/policy", headers=agent_headers)
    assert res_agent_v2.status_code == 200
    assert res_agent_v2.json()["version_number"] == 2
    assert res_agent_v2.json()["content_hash"] == v2_hash

    # Admin rolls back to v1
    rollback_res = client.post(
        f"/api/v1/policies/{policy.id}/rollback?target_version_id={v1.id}",
        headers=headers
    )
    assert rollback_res.status_code == 200

    # Agent fetches policy again -> returns rolled-back v1 with valid hash
    res_agent_post_rollback = client.get("/api/v1/agent/policy", headers=agent_headers)
    assert res_agent_post_rollback.status_code == 200
    post_data = res_agent_post_rollback.json()
    assert post_data["version_number"] == 1
    assert post_data["version_id"] == str(v1.id)
    assert post_data["content_hash"] == v1_hash
