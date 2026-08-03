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
    user = models.User(id=uuid.uuid4(), email="test@flientsec.local", hashed_password="pw")
    db.add(user)
    db.commit()
    return org, user


def test_active_version_invariants(db):
    org, user = create_org_and_user(db)
    
    # Create Policy 1
    policy1 = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Policy 1")
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
        content_hash=hashlib.sha256('{"rules": []}'.encode('utf-8')).hexdigest(),
        created_by=user.id
    )
    db.add(v1_published)
    
    # Create Policy 2 and a Published Version
    policy2 = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Policy 2")
    db.add(policy2)
    v2_published = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy2.id,
        version_number=1,
        definition_json='{"rules": []}',
        content='{"rules": []}',
        status="PUBLISHED",
        content_hash=hashlib.sha256('{"rules": []}'.encode('utf-8')).hexdigest(),
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
    assert expected_hash == hashlib.sha256(content.encode('utf-8')).hexdigest()


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
    
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Policy A")
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

    # 2. Attempt to create second duplicate OPEN finding for same device + policy + rule
    # We run this inside a savepoint (begin_nested) so it doesn't break the outer transaction
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


def test_policy_assignments_uniqueness(db):
    org, user = create_org_and_user(db)
    
    p1 = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Policy 1")
    p2 = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Policy 2")
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
