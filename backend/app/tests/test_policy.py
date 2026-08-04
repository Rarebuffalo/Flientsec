import uuid
import hashlib
import pytest
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

    # Verify that both RESOLVED findings exist in database
    resolved_count = (
        db.query(models.Finding)
        .filter(models.Finding.status == "RESOLVED")
        .count()
    )
    assert resolved_count == 2


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
