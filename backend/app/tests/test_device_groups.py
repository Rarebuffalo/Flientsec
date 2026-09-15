import json
import uuid
import yaml
from fastapi.testclient import TestClient
from app.main import app
from app.core import security
from app.models import models


def setup_groups_test_environment(db):
    """
    Sets up two isolated organizations:
    Org 1 (Acme Corp):
      - owner1, admin1, viewer1
      - default policy (Org Default)
      - group policy (Group Policy)
      - override policy (Device Override)
      - device 1 (will be grouped)
      - device 2 (will have override)
      - device 3 (ungrouped)
    Org 2 (Beta Corp):
      - owner2, viewer2
      - beta policy
      - beta device
    """
    # Organization 1
    org1 = models.Organization(id=uuid.uuid4(), name="Acme Fleet Org")
    db.add(org1)

    owner1 = models.User(
        id=uuid.uuid4(),
        email=f"owner_{uuid.uuid4().hex[:6]}@acme.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    admin1 = models.User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@acme.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    viewer1 = models.User(
        id=uuid.uuid4(),
        email=f"viewer_{uuid.uuid4().hex[:6]}@acme.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add_all([owner1, admin1, viewer1])
    db.commit()

    m_owner1 = models.Member(id=uuid.uuid4(), user_id=owner1.id, organization_id=org1.id, role="owner")
    m_admin1 = models.Member(id=uuid.uuid4(), user_id=admin1.id, organization_id=org1.id, role="admin")
    m_viewer1 = models.Member(id=uuid.uuid4(), user_id=viewer1.id, organization_id=org1.id, role="viewer")
    db.add_all([m_owner1, m_admin1, m_viewer1])
    db.commit()

    # Policies for Org 1
    # 1. Org Default Policy
    pol_default = models.Policy(id=uuid.uuid4(), organization_id=org1.id, name="Acme Default Policy")
    db.add(pol_default)
    db.commit()
    v_default = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=pol_default.id,
        version_number=1,
        definition_json=json.dumps({"rules": {"firewall": "enabled"}}),
        status="PUBLISHED",
        content="rules:\n  firewall: enabled",
        content_hash="hash_default_123",
        created_by=owner1.id,
    )
    db.add(v_default)
    db.commit()
    pol_default.active_version_id = v_default.id

    # Org Default Policy Assignment
    assign_default = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org1.id,
        policy_id=pol_default.id,
        device_id=None,
    )
    db.add(assign_default)
    db.commit()

    # 2. Group Policy
    pol_group = models.Policy(id=uuid.uuid4(), organization_id=org1.id, name="Engineering Group Policy")
    db.add(pol_group)
    db.commit()
    v_group = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=pol_group.id,
        version_number=1,
        definition_json=json.dumps({"rules": {"firewall": "enabled", "encryption": "enabled"}}),
        status="PUBLISHED",
        content="rules:\n  firewall: enabled\n  encryption: enabled",
        content_hash="hash_group_456",
        created_by=owner1.id,
    )
    db.add(v_group)
    db.commit()
    pol_group.active_version_id = v_group.id
    db.commit()

    # 3. Direct Device Override Policy
    pol_override = models.Policy(id=uuid.uuid4(), organization_id=org1.id, name="Direct Device Override Policy")
    db.add(pol_override)
    db.commit()
    v_override = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=pol_override.id,
        version_number=1,
        definition_json=json.dumps({"rules": {"ssh_disabled": True}}),
        status="PUBLISHED",
        content="rules:\n  ssh_disabled: true",
        content_hash="hash_override_789",
        created_by=owner1.id,
    )
    db.add(v_override)
    db.commit()
    pol_override.active_version_id = v_override.id
    db.commit()

    # Devices for Org 1
    dev1 = models.Device(
        id=uuid.uuid4(),
        organization_id=org1.id,
        hostname="eng-workstation-01",
        os_name="Ubuntu",
        os_version="22.04",
        os_arch="x86_64",
        kernel_version="5.15.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="PASS",
        compliance_score=100,
        device_token="token_dev1_secret",
    )
    dev2 = models.Device(
        id=uuid.uuid4(),
        organization_id=org1.id,
        hostname="sec-workstation-02",
        os_name="Ubuntu",
        os_version="22.04",
        os_arch="x86_64",
        kernel_version="5.15.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="PASS",
        compliance_score=100,
        device_token="token_dev2_secret",
    )
    dev3 = models.Device(
        id=uuid.uuid4(),
        organization_id=org1.id,
        hostname="general-workstation-03",
        os_name="Debian",
        os_version="12",
        os_arch="x86_64",
        kernel_version="6.1.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="PASS",
        compliance_score=100,
        device_token="token_dev3_secret",
    )
    db.add_all([dev1, dev2, dev3])
    db.commit()

    # Organization 2 (Beta)
    org2 = models.Organization(id=uuid.uuid4(), name="Beta Isolated Corp")
    db.add(org2)

    owner2 = models.User(
        id=uuid.uuid4(),
        email=f"owner_{uuid.uuid4().hex[:6]}@beta.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    viewer2 = models.User(
        id=uuid.uuid4(),
        email=f"viewer_{uuid.uuid4().hex[:6]}@beta.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add_all([owner2, viewer2])
    db.commit()

    m_owner2 = models.Member(id=uuid.uuid4(), user_id=owner2.id, organization_id=org2.id, role="owner")
    m_viewer2 = models.Member(id=uuid.uuid4(), user_id=viewer2.id, organization_id=org2.id, role="viewer")
    db.add_all([m_owner2, m_viewer2])
    db.commit()

    pol_beta = models.Policy(id=uuid.uuid4(), organization_id=org2.id, name="Beta Policy")
    db.add(pol_beta)
    db.commit()

    dev_beta = models.Device(
        id=uuid.uuid4(),
        organization_id=org2.id,
        hostname="beta-server-01",
        os_name="Ubuntu",
        os_version="24.04",
        os_arch="x86_64",
        kernel_version="6.8.0",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="PASS",
        compliance_score=100,
        device_token="token_beta_secret",
    )
    db.add(dev_beta)
    db.commit()

    # Create tokens for API testing
    tok_owner1 = security.create_access_token(owner1.email)
    tok_admin1 = security.create_access_token(admin1.email)
    tok_viewer1 = security.create_access_token(viewer1.email)
    tok_owner2 = security.create_access_token(owner2.email)
    tok_viewer2 = security.create_access_token(viewer2.email)

    return {
        "org1": org1,
        "owner1": owner1,
        "admin1": admin1,
        "viewer1": viewer1,
        "tok_owner1": tok_owner1,
        "tok_admin1": tok_admin1,
        "tok_viewer1": tok_viewer1,
        "pol_default": pol_default,
        "pol_group": pol_group,
        "pol_override": pol_override,
        "dev1": dev1,
        "dev2": dev2,
        "dev3": dev3,
        "org2": org2,
        "owner2": owner2,
        "viewer2": viewer2,
        "tok_owner2": tok_owner2,
        "tok_viewer2": tok_viewer2,
        "pol_beta": pol_beta,
        "dev_beta": dev_beta,
    }


def test_device_group_crud_and_validation(client: TestClient, db):
    data = setup_groups_test_environment(db)
    headers_admin = {"Authorization": f"Bearer {data['tok_admin1']}"}
    headers_viewer = {"Authorization": f"Bearer {data['tok_viewer1']}"}

    # 1. List groups (empty initially)
    res = client.get("/api/v1/device-groups", headers=headers_viewer)
    assert res.status_code == 200
    assert res.json() == []

    # 2. Create Group (Admin)
    payload = {
        "name": "Engineering Fleet",
        "description": "Workstations assigned to backend and core developers"
    }
    res = client.post("/api/v1/device-groups", json=payload, headers=headers_admin)
    assert res.status_code == 201
    group = res.json()
    assert group["name"] == "Engineering Fleet"
    assert group["description"] == payload["description"]
    assert group["device_count"] == 0
    assert group["policy_id"] is None
    group_id = group["id"]

    # 3. Duplicate name in same org rejected
    res = client.post("/api/v1/device-groups", json=payload, headers=headers_admin)
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"].lower()

    # 4. Get Group Detail (Viewer)
    res = client.get(f"/api/v1/device-groups/{group_id}", headers=headers_viewer)
    assert res.status_code == 200
    detail = res.json()
    assert detail["id"] == group_id
    assert detail["name"] == "Engineering Fleet"
    assert detail["device_count"] == 0

    # 5. Patch Group (Admin)
    update_payload = {
        "name": "Core Engineering Fleet",
        "description": "Updated core fleet description"
    }
    res = client.patch(f"/api/v1/device-groups/{group_id}", json=update_payload, headers=headers_admin)
    assert res.status_code == 200
    updated = res.json()
    assert updated["name"] == "Core Engineering Fleet"
    assert updated["description"] == update_payload["description"]

    # 6. Delete Group (Admin)
    res = client.delete(f"/api/v1/device-groups/{group_id}", headers=headers_admin)
    assert res.status_code == 200
    assert "successfully deleted" in res.json()["message"]

    # 7. Verify deletion
    res = client.get(f"/api/v1/device-groups/{group_id}", headers=headers_viewer)
    assert res.status_code == 404


def test_device_group_rbac_enforcement(client: TestClient, db):
    data = setup_groups_test_environment(db)
    headers_owner = {"Authorization": f"Bearer {data['tok_owner1']}"}
    headers_viewer = {"Authorization": f"Bearer {data['tok_viewer1']}"}

    # 1. Create group via Owner
    res = client.post(
        "/api/v1/device-groups",
        json={"name": "Security Team", "description": "Security workstations"},
        headers=headers_owner,
    )
    assert res.status_code == 201
    group_id = res.json()["id"]

    # 2. Viewer attempts mutation (all must return 403 Forbidden)
    # Create group as viewer -> 403
    res = client.post(
        "/api/v1/device-groups",
        json={"name": "Viewer Forbidden Group"},
        headers=headers_viewer,
    )
    assert res.status_code == 403

    # Patch group as viewer -> 403
    res = client.patch(
        f"/api/v1/device-groups/{group_id}",
        json={"name": "Hacked Group Name"},
        headers=headers_viewer,
    )
    assert res.status_code == 403

    # Add device as viewer -> 403
    res = client.post(
        f"/api/v1/device-groups/{group_id}/devices/{data['dev1'].id}",
        headers=headers_viewer,
    )
    assert res.status_code == 403

    # Assign policy as viewer -> 403
    res = client.post(
        f"/api/v1/device-groups/{group_id}/policy",
        json={"policy_id": str(data["pol_group"].id)},
        headers=headers_viewer,
    )
    assert res.status_code == 403

    # Delete group as viewer -> 403
    res = client.delete(
        f"/api/v1/device-groups/{group_id}",
        headers=headers_viewer,
    )
    assert res.status_code == 403

    # 3. Viewer can READ
    res = client.get("/api/v1/device-groups", headers=headers_viewer)
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = client.get(f"/api/v1/device-groups/{group_id}", headers=headers_viewer)
    assert res.status_code == 200


def test_device_group_tenant_isolation(client: TestClient, db):
    data = setup_groups_test_environment(db)
    headers_org1 = {"Authorization": f"Bearer {data['tok_admin1']}"}
    headers_org2 = {"Authorization": f"Bearer {data['tok_owner2']}"}

    # 1. Create group in Org 1
    res = client.post(
        "/api/v1/device-groups",
        json={"name": "Org 1 Production Group"},
        headers=headers_org1,
    )
    assert res.status_code == 201
    org1_group_id = res.json()["id"]

    # 2. Org 2 attempts to GET Org 1's group -> 404 Not Found (tenant-isolated)
    res = client.get(f"/api/v1/device-groups/{org1_group_id}", headers=headers_org2)
    assert res.status_code == 404

    # 3. Org 2 attempts to PATCH Org 1's group -> 404 Not Found
    res = client.patch(
        f"/api/v1/device-groups/{org1_group_id}",
        json={"name": "Org 2 hijacked name"},
        headers=headers_org2,
    )
    assert res.status_code == 404

    # 4. Org 1 attempts to add Org 2's device into Org 1's group -> 404
    res = client.post(
        f"/api/v1/device-groups/{org1_group_id}/devices/{data['dev_beta'].id}",
        headers=headers_org1,
    )
    assert res.status_code == 404
    assert "not found in this organization" in res.json()["detail"].lower()

    # 5. Org 1 attempts to assign Org 2's policy to Org 1's group -> 404
    res = client.post(
        f"/api/v1/device-groups/{org1_group_id}/policy",
        json={"policy_id": str(data["pol_beta"].id)},
        headers=headers_org1,
    )
    assert res.status_code == 404
    assert "not found in this organization" in res.json()["detail"].lower()


def test_device_group_membership_lifecycle(client: TestClient, db):
    data = setup_groups_test_environment(db)
    headers_admin = {"Authorization": f"Bearer {data['tok_admin1']}"}
    headers_viewer = {"Authorization": f"Bearer {data['tok_viewer1']}"}

    # 1. Create group
    res = client.post(
        "/api/v1/device-groups",
        json={"name": "Infrastructure Fleet"},
        headers=headers_admin,
    )
    assert res.status_code == 201
    group_id = res.json()["id"]

    # 2. Add device 1 to group
    res = client.post(
        f"/api/v1/device-groups/{group_id}/devices/{data['dev1'].id}",
        headers=headers_admin,
    )
    assert res.status_code == 200
    dev_resp = res.json()
    assert dev_resp["group_id"] == group_id
    assert dev_resp["group_name"] == "Infrastructure Fleet"

    # 3. List group devices
    res = client.get(f"/api/v1/device-groups/{group_id}/devices", headers=headers_viewer)
    assert res.status_code == 200
    devices = res.json()
    assert len(devices) == 1
    assert devices[0]["id"] == str(data["dev1"].id)

    # 4. Check group stats updated
    res = client.get(f"/api/v1/device-groups/{group_id}", headers=headers_viewer)
    assert res.status_code == 200
    assert res.json()["device_count"] == 1
    assert res.json()["compliant_count"] == 1

    # 5. Remove device 1 from group
    res = client.delete(
        f"/api/v1/device-groups/{group_id}/devices/{data['dev1'].id}",
        headers=headers_admin,
    )
    assert res.status_code == 200
    assert res.json()["group_id"] is None
    assert res.json()["group_name"] is None

    # 6. Verify group is now empty
    res = client.get(f"/api/v1/device-groups/{group_id}/devices", headers=headers_viewer)
    assert res.status_code == 200
    assert len(res.json()) == 0

    # 7. Cannot add decommissioned device
    data["dev1"].status = "DECOMMISSIONED"
    db.commit()
    res = client.post(
        f"/api/v1/device-groups/{group_id}/devices/{data['dev1'].id}",
        headers=headers_admin,
    )
    assert res.status_code == 400
    assert "decommissioned" in res.json()["detail"].lower()


def test_effective_policy_precedence_tier_resolution(client: TestClient, db):
    """
    Verifies the 3-tier deterministic policy precedence:
    1. Direct Device Override
    2. Device Group Policy
    3. Organization Default Policy
    """
    data = setup_groups_test_environment(db)
    headers_admin = {"Authorization": f"Bearer {data['tok_admin1']}"}
    dev1 = data["dev1"]
    dev2 = data["dev2"]
    dev3 = data["dev3"]

    # STEP A: Device 3 has no group and no override -> Must resolve to Organization Default
    res = client.get(f"/api/v1/devices/{dev3.id}/effective-policy", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["name"] == "Acme Default Policy"

    res = client.get(f"/api/v1/devices/{dev3.id}", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["effective_policy_source"] == "ORG_DEFAULT"
    assert res.json()["effective_policy_name"] == "Acme Default Policy"

    # STEP B: Create Group, assign Group Policy, and add Device 1 to group
    res = client.post(
        "/api/v1/device-groups",
        json={"name": "Engineering Fleet Tier Test"},
        headers=headers_admin,
    )
    assert res.status_code == 201
    group_id = res.json()["id"]

    res = client.post(
        f"/api/v1/device-groups/{group_id}/policy",
        json={"policy_id": str(data["pol_group"].id)},
        headers=headers_admin,
    )
    assert res.status_code == 200
    assert res.json()["policy_name"] == "Engineering Group Policy"

    # Add dev1 and dev2 to group
    res = client.post(
        f"/api/v1/device-groups/{group_id}/devices/{dev1.id}",
        headers=headers_admin,
    )
    assert res.status_code == 200
    res = client.post(
        f"/api/v1/device-groups/{group_id}/devices/{dev2.id}",
        headers=headers_admin,
    )
    assert res.status_code == 200

    # Device 1: In Group, no override -> Resolves to Group Policy
    res = client.get(f"/api/v1/devices/{dev1.id}/effective-policy", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["name"] == "Engineering Group Policy"

    res = client.get(f"/api/v1/devices/{dev1.id}", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["effective_policy_source"] == "GROUP_POLICY"
    assert res.json()["effective_policy_name"] == "Engineering Group Policy"

    # Verify agent policy delivery returns group policy
    headers_agent1 = {
        "Device-Uuid": str(dev1.id),
        "X-Device-Token": dev1.device_token,
    }
    res = client.get("/api/v1/agent/policy", headers=headers_agent1)
    assert res.status_code == 200
    assert res.json()["policy_name"] == "Engineering Group Policy"

    # STEP C: Assign Direct Device Override to Device 2
    # Device 2 is in group, but has direct override -> Direct override takes highest priority!
    res = client.post(
        f"/api/v1/policies/{data['pol_override'].id}/assign-device/{dev2.id}",
        headers=headers_admin,
    )
    assert res.status_code == 200

    res = client.get(f"/api/v1/devices/{dev2.id}/effective-policy", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["name"] == "Direct Device Override Policy"

    res = client.get(f"/api/v1/devices/{dev2.id}", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["effective_policy_source"] == "DEVICE_OVERRIDE"
    assert res.json()["effective_policy_name"] == "Direct Device Override Policy"

    headers_agent2 = {
        "Device-Uuid": str(dev2.id),
        "X-Device-Token": dev2.device_token,
    }
    res = client.get("/api/v1/agent/policy", headers=headers_agent2)
    assert res.status_code == 200
    assert res.json()["policy_name"] == "Direct Device Override Policy"

    # STEP D: Unassign Group Policy -> Dev1 falls back to Org Default, Dev2 still has Direct Override
    res = client.delete(f"/api/v1/device-groups/{group_id}/policy", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["policy_id"] is None

    # Dev1 now falls back to Org Default
    res = client.get(f"/api/v1/devices/{dev1.id}/effective-policy", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["name"] == "Acme Default Policy"

    res = client.get(f"/api/v1/devices/{dev1.id}", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["effective_policy_source"] == "ORG_DEFAULT"

    # Dev2 still has Direct Device Override
    res = client.get(f"/api/v1/devices/{dev2.id}/effective-policy", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["name"] == "Direct Device Override Policy"

    res = client.get(f"/api/v1/devices/{dev2.id}", headers=headers_admin)
    assert res.status_code == 200
    assert res.json()["effective_policy_source"] == "DEVICE_OVERRIDE"


def test_device_group_audit_events(client: TestClient, db):
    data = setup_groups_test_environment(db)
    headers_admin = {"Authorization": f"Bearer {data['tok_admin1']}"}
    dev1 = data["dev1"]

    # 1. Create group -> DEVICE_GROUP_CREATED
    res = client.post(
        "/api/v1/device-groups",
        json={"name": "Audit Test Group"},
        headers=headers_admin,
    )
    assert res.status_code == 201
    group_id = res.json()["id"]

    ev_created = (
        db.query(models.Event)
        .filter(models.Event.type == "DEVICE_GROUP_CREATED")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert ev_created is not None
    assert "Audit Test Group" in ev_created.message

    # 2. Add device -> DEVICE_ADDED_TO_GROUP
    client.post(
        f"/api/v1/device-groups/{group_id}/devices/{dev1.id}",
        headers=headers_admin,
    )
    ev_add = (
        db.query(models.Event)
        .filter(models.Event.type == "DEVICE_ADDED_TO_GROUP")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert ev_add is not None
    assert dev1.hostname in ev_add.message

    # 3. Assign policy -> GROUP_POLICY_ASSIGNED
    client.post(
        f"/api/v1/device-groups/{group_id}/policy",
        json={"policy_id": str(data["pol_group"].id)},
        headers=headers_admin,
    )
    ev_assign = (
        db.query(models.Event)
        .filter(models.Event.type == "GROUP_POLICY_ASSIGNED")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert ev_assign is not None
    assert "Engineering Group Policy" in ev_assign.message

    # 4. Unassign policy -> GROUP_POLICY_UNASSIGNED
    client.delete(
        f"/api/v1/device-groups/{group_id}/policy",
        headers=headers_admin,
    )
    ev_unassign = (
        db.query(models.Event)
        .filter(models.Event.type == "GROUP_POLICY_UNASSIGNED")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert ev_unassign is not None
    assert "Audit Test Group" in ev_unassign.message

    # 5. Remove device -> DEVICE_REMOVED_FROM_GROUP
    client.delete(
        f"/api/v1/device-groups/{group_id}/devices/{dev1.id}",
        headers=headers_admin,
    )
    ev_remove = (
        db.query(models.Event)
        .filter(models.Event.type == "DEVICE_REMOVED_FROM_GROUP")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert ev_remove is not None
    assert dev1.hostname in ev_remove.message

    # 6. Delete group -> DEVICE_GROUP_DELETED
    client.delete(f"/api/v1/device-groups/{group_id}", headers=headers_admin)
    ev_del = (
        db.query(models.Event)
        .filter(models.Event.type == "DEVICE_GROUP_DELETED")
        .order_by(models.Event.timestamp.desc())
        .first()
    )
    assert ev_del is not None
    assert "Audit Test Group" in ev_del.message
