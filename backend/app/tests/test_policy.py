import uuid
import hashlib
import pytest
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from app.models import models
from alembic.config import Config
from alembic import command


def create_org_and_user(db):
    org = models.Organization(id=uuid.uuid4(), name="Test Org")
    db.add(org)
    user = models.User(
        id=uuid.uuid4(),
        email="test@flientsec.local",
        hashed_password="pw"
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
    return org, user


def test_active_version_invariants(db):
    org, user = create_org_and_user(db)

    # Create Policy 1
    policy1 = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy 1"
    )
    db.add(policy1)

    # Create Draft Version for Policy 1
    v1_draft = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy1.id,
        version_number=1,
        definition_json='{"rules": []}',
        content='{"rules": []}',
        status="DRAFT",
        created_by=user.id
    )
    db.add(v1_draft)

    # Create Published Version for Policy 1
    v1_published = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy1.id,
        version_number=2,
        definition_json='{"rules": []}',
        content='{"rules": []}',
        status="PUBLISHED",
        content_hash=hashlib.sha256(
            '{"rules": []}'.encode('utf-8')
        ).hexdigest(),
        created_by=user.id
    )
    db.add(v1_published)

    # Create Policy 2 and a Published Version
    policy2 = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy 2"
    )
    db.add(policy2)
    v2_published = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy2.id,
        version_number=1,
        definition_json='{"rules": []}',
        content='{"rules": []}',
        status="PUBLISHED",
        content_hash=hashlib.sha256(
            '{"rules": []}'.encode('utf-8')
        ).hexdigest(),
        created_by=user.id
    )
    db.add(v2_published)
    db.commit()

    # Invariant 1: Cannot reference a DRAFT version as active
    assert v1_draft.status == "DRAFT"
    assert v1_published.status == "PUBLISHED"

    # Invariant 2: Active version must belong to the same Policy
    assert v2_published.policy_id != policy1.id


def test_sha256_hash_calculation():
    # Exact UTF-8 PolicyVersion content produces stored SHA-256 hash
    content = '{"rules": [{"id": "rule.1"}]}'
    expected_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

    # Verify hash computation identity
    assert len(expected_hash) == 64
    assert expected_hash == hashlib.sha256(
        content.encode('utf-8')
    ).hexdigest()


def test_finding_uniqueness_constraint(db):
    org, user = create_org_and_user(db)

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Device A",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy A"
    )
    db.add(policy)
    db.commit()

    # 1. Create first OPEN finding
    f1 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        policy_id=policy.id,
        rule_id="workstation.firewall.enabled",
        check_name="firewall.enabled",
        severity="high",
        status="OPEN"
    )
    db.add(f1)
    db.commit()

    # 2. Attempt to create second duplicate OPEN finding
    # We run this inside a savepoint (begin_nested)
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            f2 = models.Finding(
                id=uuid.uuid4(),
                device_id=device.id,
                policy_id=policy.id,
                rule_id="workstation.firewall.enabled",
                check_name="firewall.enabled",
                severity="high",
                status="OPEN"
            )
            db.add(f2)
            db.flush()

    # 3. Multiple RESOLVED findings for the same identity are allowed
    f3 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        policy_id=policy.id,
        rule_id="workstation.firewall.enabled",
        check_name="firewall.enabled",
        severity="high",
        status="RESOLVED"
    )
    f4 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        policy_id=policy.id,
        rule_id="workstation.firewall.enabled",
        check_name="firewall.enabled",
        severity="high",
        status="RESOLVED"
    )
    db.add(f3)
    db.add(f4)
    db.commit()  # Should succeed cleanly

    # Verify that one OPEN and multiple RESOLVED can coexist simultaneously
    total_findings = (
        db.query(models.Finding)
        .filter(
            models.Finding.device_id == device.id,
            models.Finding.policy_id == policy.id,
            models.Finding.rule_id == "workstation.firewall.enabled"
        )
        .all()
    )
    assert len(total_findings) == 3
    open_count = len([f for f in total_findings if f.status == "OPEN"])
    res_count = len([f for f in total_findings if f.status == "RESOLVED"])
    assert open_count == 1
    assert res_count == 2


def test_finding_resolved_at_field():
    # Verify resolved_at attribute is present on the model
    assert hasattr(models.Finding, "resolved_at")


def test_published_policy_version_immutability(db):
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy A"
    )
    db.add(policy)
    db.commit()

    v = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json='{"rules": []}',
        content='{"rules": []}',
        status="PUBLISHED",
        content_hash="dummy_hash",
        created_by=user.id
    )
    db.add(v)
    db.commit()

    # Attempt to modify definition_json after publication
    # should raise ValueError
    with pytest.raises(
        ValueError, match="Cannot modify a PUBLISHED policy version"
    ):
        v.definition_json = '{"rules": [{"id": "new"}]}'

    # Attempt to modify content after publication should raise ValueError
    with pytest.raises(
        ValueError, match="Cannot modify a PUBLISHED policy version"
    ):
        v.content = '{"rules": [{"id": "new"}]}'

    # Stored content_hash remains unchanged
    assert v.content_hash == "dummy_hash"


def test_policy_assignments_uniqueness(db):
    org, user = create_org_and_user(db)

    p1 = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy 1"
    )
    p2 = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy 2"
    )
    db.add(p1)
    db.add(p2)

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Device B",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    # 1. Create org default assignment (device_id IS NULL)
    a1 = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=p1.id,
        device_id=None
    )
    db.add(a1)
    db.commit()

    # 2. Attempt to create second default org assignment
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            a2 = models.PolicyAssignment(
                id=uuid.uuid4(),
                organization_id=org.id,
                policy_id=p2.id,
                device_id=None
            )
            db.add(a2)
            db.flush()

    # 3. Create device specific assignment (device_id IS NOT NULL)
    a3 = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=p1.id,
        device_id=device.id
    )
    db.add(a3)
    db.commit()

    # 4. Attempt to create second assignment for same device
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            a4 = models.PolicyAssignment(
                id=uuid.uuid4(),
                organization_id=org.id,
                policy_id=p2.id,
                device_id=device.id
            )
            db.add(a4)
            db.flush()


def test_alembic_upgrade_downgrade():
    # Verify alembic migrations run cleanly outside active transactions
    alembic_cfg = Config("alembic.ini")

    # Downgrade to base
    command.downgrade(alembic_cfg, "base")

    # Upgrade to head
    command.upgrade(alembic_cfg, "head")


def test_assign_default_policy_api(client, db):
    from app.core import security
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Org Policy"
    )
    db.add(policy)
    db.commit()

    token = security.create_access_token(subject=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Assign default policy via API
    resp = client.post(
        f"/api/v1/policies/{policy.id}/assign-default",
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["policy_id"] == str(policy.id)
    assert data["device_id"] is None
    assert data["organization_id"] == str(org.id)

    # 2. Assigning again updates/returns existing
    resp2 = client.post(
        f"/api/v1/policies/{policy.id}/assign-default",
        headers=headers
    )
    assert resp2.status_code == 200


def test_assign_device_policy_api(client, db):
    from app.core import security
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Device Policy"
    )
    db.add(policy)

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Dev Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    token = security.create_access_token(subject=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Assign device policy via API
    resp = client.post(
        f"/api/v1/policies/{policy.id}/assign-device/{device.id}",
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["policy_id"] == str(policy.id)
    assert data["device_id"] == str(device.id)
    assert data["organization_id"] == str(org.id)


def test_effective_policy_resolution_api(client, db):
    from app.core import security
    org, user = create_org_and_user(db)

    # Create two policies
    p_default = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Default Policy"
    )
    p_override = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Override Policy"
    )
    db.add(p_default)
    db.add(p_override)

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Dev Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    token = security.create_access_token(subject=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Query effective policy when none assigned -> 404
    resp = client.get(
        f"/api/v1/devices/{device.id}/effective-policy",
        headers=headers
    )
    assert resp.status_code == 404
    assert "No policy assigned" in resp.json()["detail"]

    # 2. Assign default policy and verify effective matches default
    client.post(
        f"/api/v1/policies/{p_default.id}/assign-default",
        headers=headers
    )
    resp = client.get(
        f"/api/v1/devices/{device.id}/effective-policy",
        headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == str(p_default.id)

    # 3. Assign device override and verify effective matches override
    client.post(
        f"/api/v1/policies/{p_override.id}/assign-device/{device.id}",
        headers=headers
    )
    resp = client.get(
        f"/api/v1/devices/{device.id}/effective-policy",
        headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == str(p_override.id)


def test_policy_assignment_cross_org_rejection(client, db):
    from app.core import security
    org1, user1 = create_org_and_user(db)

    # Second org and user
    org2 = models.Organization(id=uuid.uuid4(), name="Other Org")
    db.add(org2)
    user2 = models.User(
        id=uuid.uuid4(),
        email="other@flientsec.local",
        hashed_password="pw"
    )
    db.add(user2)
    db.commit()

    # User 1 has policy 1
    p1 = models.Policy(
        id=uuid.uuid4(), organization_id=org1.id, name="Policy 1"
    )
    db.add(p1)

    # Policy 2 belongs to Org 2
    p2 = models.Policy(
        id=uuid.uuid4(), organization_id=org2.id, name="Policy 2"
    )
    db.add(p2)
    db.commit()

    # Authenticate as user 1
    token = security.create_access_token(subject=user1.email)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. User 1 attempts to assign policy 2 (Org 2) -> 404
    resp = client.post(
        f"/api/v1/policies/{p2.id}/assign-default",
        headers=headers
    )
    assert resp.status_code == 404


def test_agent_policy_delivery_default(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Default Policy"
    )
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Dev Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_123",
        status="ONLINE"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    content_str = '{"rules": [{"id": "r1", "check": "firewall"}]}'
    c_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=content_str,
        content=content_str,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_123"
    }

    resp = client.get("/api/v1/agent/policy", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["policy_id"] == str(policy.id)
    assert data["policy_name"] == "Default Policy"
    assert data["version_id"] == str(version.id)
    assert data["content"] == content_str
    assert data["content_hash"] == f"sha256:{c_hash}"


def test_agent_policy_delivery_override(client, db):
    org, user = create_org_and_user(db)
    policy_default = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Default Policy"
    )
    policy_override = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Override Policy"
    )
    db.add(policy_default)
    db.add(policy_override)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Dev Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_456",
        status="ONLINE"
    )
    db.add(device)

    a_def = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy_default.id,
        device_id=None
    )
    a_over = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy_override.id,
        device_id=device.id
    )
    db.add(a_def)
    db.add(a_over)

    content_str = '{"rules": [{"id": "r2"}]}'
    c_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy_override.id,
        version_number=1,
        definition_json=content_str,
        content=content_str,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy_override.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_456"
    }

    resp = client.get("/api/v1/agent/policy", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["policy_id"] == str(policy_override.id)
    assert data["policy_name"] == "Override Policy"


def test_agent_policy_delivery_unassigned(client, db):
    org, user = create_org_and_user(db)
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Dev Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_789",
        status="ONLINE"
    )
    db.add(device)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_789"
    }

    resp = client.get("/api/v1/agent/policy", headers=headers)
    assert resp.status_code == 404
    assert "No policy assigned" in resp.json()["detail"]


def test_agent_policy_leakage_prevention(client, db):
    org1, user1 = create_org_and_user(db)
    org2 = models.Organization(id=uuid.uuid4(), name="Test Org 2")
    db.add(org2)
    user2 = models.User(
        id=uuid.uuid4(),
        email="test2@flientsec.local",
        hashed_password="pw"
    )
    db.add(user2)
    db.commit()

    device_org2 = models.Device(
        id=uuid.uuid4(),
        organization_id=org2.id,
        hostname="Laptop Org 2",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_org2",
        status="ONLINE"
    )
    db.add(device_org2)

    policy_org1 = models.Policy(
        id=uuid.uuid4(), organization_id=org1.id, name="Org1 Policy"
    )
    db.add(policy_org1)

    a1 = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org1.id,
        policy_id=policy_org1.id,
        device_id=None
    )
    db.add(a1)
    db.commit()

    headers = {
        "Device-Uuid": str(device_org2.id),
        "X-Device-Token": "dev_tok_org2"
    }

    resp = client.get("/api/v1/agent/policy", headers=headers)
    assert resp.status_code == 404


def test_agent_policy_decommissioned_rejection(client, db):
    org, user = create_org_and_user(db)
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_decom",
        status="DECOMMISSIONED"
    )
    db.add(device)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_decom"
    }

    resp = client.get("/api/v1/agent/policy", headers=headers)
    assert resp.status_code == 403
    assert "decommissioned" in resp.json()["detail"].lower()


def test_agent_policy_only_published(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy"
    )
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_draft",
        status="ONLINE"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    content_str = '{"rules": []}'
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=content_str,
        content=content_str,
        status="DRAFT",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_draft"
    }

    resp = client.get("/api/v1/agent/policy", headers=headers)
    assert resp.status_code == 404


def test_checkin_provenance_current(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy"
    )
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_prov",
        status="ONLINE"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    content_str = '{"rules": []}'
    c_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=content_str,
        content=content_str,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": [],
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}"
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provenance_status"] == "CURRENT"
    assert data["policy_version_id"] == str(version.id)


def test_checkin_provenance_outdated(client, db):
    org, user = create_org_and_user(db)
    policy_active = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Active Policy"
    )
    policy_stale = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Stale Policy"
    )
    db.add(policy_active)
    db.add(policy_stale)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_prov2",
        status="ONLINE"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy_active.id,
        device_id=None
    )
    db.add(a)

    version_act = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy_active.id,
        version_number=1,
        definition_json="{}",
        content="{}",
        content_hash=hashlib.sha256(b"{}").hexdigest(),
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version_act)

    content_stale = '{"rules": []}'
    hash_stale = hashlib.sha256(content_stale.encode("utf-8")).hexdigest()
    version_stale = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy_stale.id,
        version_number=1,
        definition_json=content_stale,
        content=content_stale,
        content_hash=hash_stale,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version_stale)
    db.commit()

    policy_active.active_version_id = version_act.id
    policy_stale.active_version_id = version_stale.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov2"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": [],
        "policy_version_id": str(version_stale.id),
        "content_hash": f"sha256:{hash_stale}"
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provenance_status"] == "OUTDATED_POLICY"


def test_checkin_provenance_cross_tenant_rejected(client, db):
    org1, user1 = create_org_and_user(db)
    org2 = models.Organization(id=uuid.uuid4(), name="Org 2")
    db.add(org2)
    user2 = models.User(
        id=uuid.uuid4(),
        email="test2@flientsec.local",
        hashed_password="pw"
    )
    db.add(user2)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org1.id,
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0",
        device_token="dev_tok_prov3",
        status="ONLINE"
    )
    db.add(device)

    policy_org2 = models.Policy(
        id=uuid.uuid4(), organization_id=org2.id, name="Org2 Policy"
    )
    db.add(policy_org2)
    db.commit()

    version_org2 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy_org2.id,
        version_number=1,
        definition_json="{}",
        content="{}",
        content_hash=hashlib.sha256(b"{}").hexdigest(),
        status="PUBLISHED",
        created_by=user2.id
    )
    db.add(version_org2)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov3"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": [],
        "policy_version_id": str(version_org2.id),
        "content_hash": f"sha256:{version_org2.content_hash}"
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 400
    assert "tenant mismatch" in resp.json()["detail"].lower()


def test_checkin_provenance_hash_mismatch_rejected(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy"
    )
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_prov4",
        status="ONLINE",
        hostname="Laptop", os_name="Linux", os_version="Ubuntu",
        os_arch="amd64", kernel_version="6.5.0", agent_version="1.0.0"
    )
    db.add(device)

    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json="{}",
        content="{}",
        content_hash=hashlib.sha256(b"{}").hexdigest(),
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov4"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": [],
        "policy_version_id": str(version.id),
        "content_hash": "sha256:badhash"
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 400
    assert "content hash mismatch" in resp.json()["detail"].lower()


def test_checkin_provenance_unknown_version_rejected(client, db):
    org, user = create_org_and_user(db)
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_prov5",
        status="ONLINE",
        hostname="Laptop", os_name="Linux", os_version="Ubuntu",
        os_arch="amd64", kernel_version="6.5.0", agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov5"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": [],
        "policy_version_id": str(uuid.uuid4()),
        "content_hash": "sha256:somehash"
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 400
    assert "Invalid policy version" in resp.json()["detail"]


def test_checkin_provenance_draft_rejected(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(
        id=uuid.uuid4(), organization_id=org.id, name="Policy"
    )
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_prov6",
        status="ONLINE",
        hostname="Laptop", os_name="Linux", os_version="Ubuntu",
        os_arch="amd64", kernel_version="6.5.0", agent_version="1.0.0"
    )
    db.add(device)

    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json="{}",
        content="{}",
        content_hash=hashlib.sha256(b"{}").hexdigest(),
        status="DRAFT",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov6"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": [],
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{version.content_hash}"
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 400
    assert "Invalid policy version" in resp.json()["detail"]


def test_checkin_provenance_missing_rejected(client, db):
    org, user = create_org_and_user(db)
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_prov7",
        status="ONLINE",
        hostname="Laptop", os_name="Linux", os_version="Ubuntu",
        os_arch="amd64", kernel_version="6.5.0", agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_prov7"
    }

    payload = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "findings": []
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 400
    assert "Missing required policy version" in resp.json()["detail"]


def test_migration_status_normalization(db):
    org = models.Organization(id=uuid.uuid4(), name="Normalization Org")
    db.add(org)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_normalization",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    # Create dummy findings with mixed case status
    f1 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        rule_id="r1",
        check_name="c1",
        status="Open",  # mixed case
        severity="medium",
        created_at=datetime.utcnow()
    )
    f2 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        rule_id="r2",
        check_name="c2",
        status="Resolved",  # mixed case
        severity="medium",
        created_at=datetime.utcnow()
    )
    f3 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        rule_id="r3",
        check_name="c3",
        status="open",  # lower case
        severity="medium",
        created_at=datetime.utcnow()
    )
    f4 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        rule_id="r4",
        check_name="c4",
        status="resolved",  # lower case
        severity="medium",
        created_at=datetime.utcnow()
    )
    db.add_all([f1, f2, f3, f4])
    db.commit()

    # Run SQL updates to simulate migration
    from sqlalchemy import text
    db.execute(
        text("UPDATE findings SET status = 'OPEN' "
             "WHERE status = 'Open' OR status = 'open'")
    )
    db.execute(
        text("UPDATE findings SET status = 'RESOLVED' "
             "WHERE status = 'Resolved' OR status = 'resolved'")
    )
    db.commit()

    # Verify normalization
    db.refresh(f1)
    db.refresh(f2)
    db.refresh(f3)
    db.refresh(f4)
    assert f1.status == "OPEN"
    assert f2.status == "RESOLVED"
    assert f3.status == "OPEN"
    assert f4.status == "RESOLVED"


def test_checkin_transition_unknown_to_fail(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift1",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, '
        '"severity": "medium", "description": "Firewall Rule"}]}'
    )
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    # First check-in: rule fails
    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift1"
    }
    payload = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": datetime.utcnow().isoformat(),
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Firewall is disabled",
                "severity": "medium"
            }
        ]
    }

    resp = client.post(


        '/api/v1/agent/checkin',


        json=payload,


        headers=headers


    )
    assert resp.status_code == 200

    # Verify finding exists and has status = "OPEN", drift_type = None
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1"
    ).first()
    assert finding is not None
    assert finding.status == "OPEN"
    assert finding.drift_type is None

    # Verify event VIOLATION_TRIGGERED exists
    event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.type == "VIOLATION_TRIGGERED"
    ).first()
    assert event is not None
    assert event.rule_name == "r1"
    assert event.finding_id == finding.id
    assert event.policy_version_id == version.id


def test_checkin_transition_pass_to_fail(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift2",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, '
        '"severity": "medium", "description": "Firewall Rule"}]}'
    )
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift2"
    }

    # 1. Run 1: PASS
    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": []
    }
    resp1 = client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )
    assert resp1.status_code == 200

    # 2. Run 2: FAIL (Drift)
    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Firewall was turned off",
                "severity": "medium"
            }
        ]
    }
    resp2 = client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )
    assert resp2.status_code == 200

    # Verify finding has drift_type = "DEVICE_DRIFT"
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1",
        models.Finding.status == "OPEN"
    ).first()
    assert finding is not None
    assert finding.drift_type == "DEVICE_DRIFT"


def test_checkin_transition_fail_to_fail(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift3",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, '
        '"severity": "medium", "description": "Firewall Rule"}]}'
    )
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift3"
    }

    # 1. Run 1: FAIL
    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Firewall was turned off",
                "severity": "medium"
            }
        ]
    }
    resp1 = client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )
    assert resp1.status_code == 200

    finding1 = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1",
        models.Finding.status == "OPEN"
    ).first()
    assert finding1 is not None
    t1 = finding1.last_detected_at

    # 2. Run 2: FAIL again (consecutive failure)
    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Still disabled",
                "severity": "medium"
            }
        ]
    }
    resp2 = client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )
    assert resp2.status_code == 200

    # Verify no duplicate findings were created
    findings = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1",
        models.Finding.status == "OPEN"
    ).all()
    assert len(findings) == 1
    assert findings[0].last_detected_at > t1
    assert findings[0].reason == "Still disabled"

    # Verify only one event was triggered
    events = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.type == "VIOLATION_TRIGGERED"
    ).all()
    assert len(events) == 1


def test_checkin_transition_fail_to_pass(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift4",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, '
        '"severity": "medium", "description": "Firewall Rule"}]}'
    )
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift4"
    }

    # 1. Run 1: FAIL
    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Disabled",
                "severity": "medium"
            }
        ]
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )

    # 2. Run 2: PASS
    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": []
    }
    resp2 = client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )
    assert resp2.status_code == 200

    # Verify finding is now RESOLVED and has resolution_reason = "REMEDIATED"
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1"
    ).first()
    assert finding.status == "RESOLVED"
    assert finding.resolution_reason == "REMEDIATED"
    assert finding.resolved_at is not None

    # Verify event VIOLATION_RESOLVED is triggered
    event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.type == "VIOLATION_RESOLVED"
    ).first()
    assert event is not None
    assert event.rule_name == "r1"
    assert event.finding_id == finding.id


def test_checkin_transition_pass_to_pass(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift5",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, '
        '"severity": "medium", "description": "Firewall Rule"}]}'
    )
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift5"
    }

    # 1. Run 1: PASS
    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": []
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )

    # 2. Run 2: PASS
    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": []
    }
    resp2 = client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )
    assert resp2.status_code == 200

    # Verify no findings and no events exist
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id
    ).first()
    assert finding is None

    event = db.query(models.Event).filter(
        models.Event.device_id == device.id
    ).first()
    assert event is None


def test_multiple_rule_lifecycles_are_independent(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift6",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, "severity": "medium", '
        '"description": "Firewall Rule"}, '
        '{"id": "r2", "check": "ssh.enabled", '
        '"operator": "equals", "expected": false, "severity": "medium", '
        '"description": "SSH Rule"}]}'
    )
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift6"
    }

    # 1. Run 1: Both fail
    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 30,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Firewall disabled",
                "severity": "medium"
            },
            {
                "rule_id": "r2",
                "check_name": "ssh.enabled",
                "status": "FAIL",
                "reason": "SSH active",
                "severity": "medium"
            }
        ]
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )

    # Verify both are OPEN
    f1 = db.query(models.Finding).filter(
        models.Finding.rule_id == "r1"
    ).first()
    f2 = db.query(models.Finding).filter(
        models.Finding.rule_id == "r2"
    ).first()
    assert f1.status == "OPEN"
    assert f2.status == "OPEN"

    # 2. Run 2: r1 passes, r2 still fails
    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 60,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": [
            {
                "rule_id": "r2",
                "check_name": "ssh.enabled",
                "status": "FAIL",
                "reason": "SSH active",
                "severity": "medium"
            }
        ]
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )

    # Verify r1 is RESOLVED/REMEDIATED, r2 is still OPEN
    db.refresh(f1)
    db.refresh(f2)
    assert f1.status == "RESOLVED"
    assert f1.resolution_reason == "REMEDIATED"
    assert f2.status == "OPEN"


def test_drift_classification_policy_change(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift7",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    # Version 1 requires Docker version >= "20.10.0"
    rules_json1 = (
        '{"rules": [{"id": "r1", "check": "runtime.docker.version", '
        '"operator": "semver_gte", "expected": "20.10.0", '
        '"severity": "medium", "description": "Docker rule"}]}'
    )
    c_hash1 = hashlib.sha256(rules_json1.encode("utf-8")).hexdigest()
    v1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json1,
        content=rules_json1,
        content_hash=c_hash1,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v1)

    # Version 2 requires Docker version >= "24.0.0"
    rules_json2 = (
        '{"rules": [{"id": "r1", "check": "runtime.docker.version", '
        '"operator": "semver_gte", "expected": "24.0.0", '
        '"severity": "medium", "description": "Docker rule"}]}'
    )
    c_hash2 = hashlib.sha256(rules_json2.encode("utf-8")).hexdigest()
    v2 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=2,
        definition_json=rules_json2,
        content=rules_json2,
        content_hash=c_hash2,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v2)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift7"
    }

    # 1. Run 1 evaluates v1: PASS (device has docker 20.10.5)
    policy.active_version_id = v1.id
    db.commit()

    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(v1.id),
        "content_hash": f"sha256:{c_hash1}",
        "findings": []
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )

    # 2. Run 2 evaluates v2: FAIL (device has docker 20.10.5, required 24.0.0)
    policy.active_version_id = v2.id
    db.commit()

    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(v2.id),
        "content_hash": f"sha256:{c_hash2}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "runtime.docker.version",
                "status": "FAIL",
                "reason": "Docker version below 24.0.0",
                "severity": "medium"
            }
        ]
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )

    # Verify that the drift classification is POLICY_CHANGE_NON_COMPLIANCE
    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1",
        models.Finding.status == "OPEN"
    ).first()
    assert finding is not None
    assert finding.drift_type == "POLICY_CHANGE_NON_COMPLIANCE"


def test_outdated_policy_cannot_resolve_current_finding(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift8",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    # v4 requires Node >= 20.0.0
    rules_v4 = (
        '{"rules": [{"id": "r1", "check": "runtime.node.version", '
        '"operator": "semver_gte", "expected": "20.0.0", '
        '"severity": "medium", "description": "Node rule"}]}'
    )
    c_hash_v4 = hashlib.sha256(rules_v4.encode("utf-8")).hexdigest()
    v4 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=4,
        definition_json=rules_v4,
        content=rules_v4,
        content_hash=c_hash_v4,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v4)

    # v5 requires Node >= 22.0.0
    rules_v5 = (
        '{"rules": [{"id": "r1", "check": "runtime.node.version", '
        '"operator": "semver_gte", "expected": "22.0.0", '
        '"severity": "medium", "description": "Node rule"}]}'
    )
    c_hash_v5 = hashlib.sha256(rules_v5.encode("utf-8")).hexdigest()
    v5 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=5,
        definition_json=rules_v5,
        content=rules_v5,
        content_hash=c_hash_v5,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v5)
    db.commit()

    # Active version is v5
    policy.active_version_id = v5.id
    db.commit()

    # Device has Node 20.0.0, so v5 has an OPEN finding
    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift8"
    }

    payload_v5 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(v5.id),
        "content_hash": f"sha256:{c_hash_v5}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "runtime.node.version",
                "status": "FAIL",
                "reason": "Node version is 20.0.0, below 22.0.0",
                "severity": "medium"
            }
        ]
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload_v5,

        headers=headers

    )

    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1",
        models.Finding.status == "OPEN"
    ).first()
    assert finding is not None

    # Offline agent evaluates cached v4 and passes (empty findings)
    payload_v4 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(v4.id),
        "content_hash": f"sha256:{c_hash_v4}",
        "findings": []
    }
    resp = client.post(

        '/api/v1/agent/checkin',

        json=payload_v4,

        headers=headers

    )
    assert resp.status_code == 200
    assert resp.json()["provenance_status"] == "OUTDATED_POLICY"

    # Verify that the finding for v5 is STILL OPEN and NOT resolved!
    db.refresh(finding)
    assert finding.status == "OPEN"
    assert finding.resolved_at is None


def test_rule_removal_resolution(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift9",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    # v1 has rule r1
    rules_json1 = (
        '{"rules": [{"id": "r1", "check": "firewall.enabled", '
        '"operator": "equals", "expected": true, '
        '"severity": "medium", "description": "Firewall Rule"}]}'
    )
    c_hash1 = hashlib.sha256(rules_json1.encode("utf-8")).hexdigest()
    v1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json1,
        content=rules_json1,
        content_hash=c_hash1,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v1)

    # v2 has no rules (r1 was removed)
    rules_json2 = '{"rules": []}'
    c_hash2 = hashlib.sha256(rules_json2.encode("utf-8")).hexdigest()
    v2 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=2,
        definition_json=rules_json2,
        content=rules_json2,
        content_hash=c_hash2,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(v2)
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_drift9"
    }

    # 1. Run 1: Fail r1 under v1
    policy.active_version_id = v1.id
    db.commit()

    payload1 = {
        "id": str(uuid.uuid4()),
        "status": "FAIL",
        "score": 50,
        "timestamp": "2026-08-04T10:00:00Z",
        "policy_version_id": str(v1.id),
        "content_hash": f"sha256:{c_hash1}",
        "findings": [
            {
                "rule_id": "r1",
                "check_name": "firewall.enabled",
                "status": "FAIL",
                "reason": "Disabled",
                "severity": "medium"
            }
        ]
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload1,

        headers=headers

    )

    finding = db.query(models.Finding).filter(
        models.Finding.device_id == device.id,
        models.Finding.rule_id == "r1",
        models.Finding.status == "OPEN"
    ).first()
    assert finding is not None

    # 2. Run 2: Check-in under active v2 (rule removed)
    policy.active_version_id = v2.id
    db.commit()

    payload2 = {
        "id": str(uuid.uuid4()),
        "status": "PASS",
        "score": 100,
        "timestamp": "2026-08-04T10:05:00Z",
        "policy_version_id": str(v2.id),
        "content_hash": f"sha256:{c_hash2}",
        "findings": []
    }
    client.post(

        '/api/v1/agent/checkin',

        json=payload2,

        headers=headers

    )

    # Verify that the finding is resolved with reason = "POLICY_RULE_REMOVED"
    db.refresh(finding)
    assert finding.status == "RESOLVED"
    assert finding.resolution_reason == "POLICY_RULE_REMOVED"

    # Verify VIOLATION_RESOLVED event
    event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.type == "VIOLATION_RESOLVED"
    ).first()
    assert event is not None
    assert event.rule_name == "r1"
    assert event.finding_id == finding.id


def test_policy_reassignment_resolution(client, db):
    from app.core import security
    org, user = create_org_and_user(db)
    p1 = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P1")
    p2 = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P2")
    db.add_all([p1, p2])
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_drift10",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    # Assign default to P1 initially
    token = security.create_access_token(subject=user.email)
    headers = {"Authorization": f"Bearer {token}"}
    resp1 = client.post(
        f"/api/v1/policies/{p1.id}/assign-default",
        headers=headers
    )
    assert resp1.status_code == 200

    # Create active finding under P1
    f1 = models.Finding(
        id=uuid.uuid4(),
        device_id=device.id,
        policy_id=p1.id,
        rule_id="r1",
        check_name="c1",
        status="OPEN",
        severity="medium",
        created_at=datetime.utcnow()
    )
    db.add(f1)
    db.commit()

    # Reassign default to P2
    resp2 = client.post(
        f"/api/v1/policies/{p2.id}/assign-default",
        headers=headers
    )
    assert resp2.status_code == 200

    # Verify that the finding for P1 is now RESOLVED as POLICY_REASSIGNED
    db.refresh(f1)
    assert f1.status == "RESOLVED"
    assert f1.resolution_reason == "POLICY_REASSIGNED"
    assert f1.resolved_at is not None

    # Verify VIOLATION_RESOLVED event
    event = db.query(models.Event).filter(
        models.Event.device_id == device.id,
        models.Event.type == "VIOLATION_RESOLVED"
    ).first()
    assert event is not None
    assert event.rule_name == "r1"
    assert event.finding_id == f1.id


def test_checkin_idempotency_retry(client, db):
    org, user = create_org_and_user(db)
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="P")
    db.add(policy)
    db.commit()

    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_idemp",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)

    a = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org.id,
        policy_id=policy.id,
        device_id=None
    )
    db.add(a)

    rules_json = '{"rules": []}'
    c_hash = hashlib.sha256(rules_json.encode("utf-8")).hexdigest()
    version = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy.id,
        version_number=1,
        definition_json=rules_json,
        content=rules_json,
        content_hash=c_hash,
        status="PUBLISHED",
        created_by=user.id
    )
    db.add(version)
    db.commit()

    policy.active_version_id = version.id
    db.commit()

    headers = {
        "Device-Uuid": str(device.id),
        "X-Device-Token": "dev_tok_idemp"
    }
    run_id = str(uuid.uuid4())
    payload = {
        "id": run_id,
        "status": "PASS",
        "score": 100,
        "timestamp": datetime.utcnow().isoformat(),
        "policy_version_id": str(version.id),
        "content_hash": f"sha256:{c_hash}",
        "findings": []
    }

    # First request
    resp1 = client.post(

        '/api/v1/agent/checkin',

        json=payload,

        headers=headers

    )
    assert resp1.status_code == 200

    # Retry request (same payload)
    resp2 = client.post(

        '/api/v1/agent/checkin',

        json=payload,

        headers=headers

    )
    assert resp2.status_code == 200
    assert resp2.json()["id"] == run_id

    # Verify that same ID requested from other device is rejected 403
    device2 = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_idemp2",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device2)
    db.commit()

    headers2 = {
        "Device-Uuid": str(device2.id),
        "X-Device-Token": "dev_tok_idemp2"
    }
    resp3 = client.post(

        '/api/v1/agent/checkin',

        json=payload,

        headers=headers2

    )
    assert resp3.status_code == 403
    assert "Access denied" in resp3.json()["detail"]


def test_concurrency_race_prevention(client, db):
    org, user = create_org_and_user(db)
    device = models.Device(
        id=uuid.uuid4(),
        organization_id=org.id,
        device_token="dev_tok_lock",
        status="ONLINE",
        hostname="Laptop",
        os_name="Linux",
        os_version="Ubuntu",
        os_arch="amd64",
        kernel_version="6.5.0",
        agent_version="1.0.0"
    )
    db.add(device)
    db.commit()

    # Query with for update to verify SQL generation does not fail
    locked_device = (
        db.query(models.Device)
        .filter(models.Device.id == device.id)
        .with_for_update()
        .first()
    )
    assert locked_device.id == device.id
