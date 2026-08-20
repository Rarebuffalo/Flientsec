import uuid
import datetime
import json
import hashlib
from app.core import security
from app.models import models


def setup_rbac_data(db):
    """
    Sets up two isolated organizations with:
    - Org 1:
      - Owner user
      - Admin user
      - Viewer user
      - Policy with 1 published version
      - 1 Enrolled device
      - 1 Active finding
      - 1 Webhook
    - Org 2:
      - Admin user in Org 2
    """
    # 1. Organization 1
    org1 = models.Organization(id=uuid.uuid4(), name="RBAC Test Corp 1")
    db.add(org1)

    # Org 1 Owner
    owner_user = models.User(
        id=uuid.uuid4(),
        email=f"owner_{uuid.uuid4().hex[:6]}@rbac.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(owner_user)
    db.commit()
    owner_member = models.Member(
        id=uuid.uuid4(),
        user_id=owner_user.id,
        organization_id=org1.id,
        role="owner",
    )
    db.add(owner_member)

    # Org 1 Admin
    admin_user = models.User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@rbac.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(admin_user)
    db.commit()
    admin_member = models.Member(
        id=uuid.uuid4(),
        user_id=admin_user.id,
        organization_id=org1.id,
        role="admin",
    )
    db.add(admin_member)

    # Org 1 Viewer
    viewer_user = models.User(
        id=uuid.uuid4(),
        email=f"viewer_{uuid.uuid4().hex[:6]}@rbac.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(viewer_user)
    db.commit()
    viewer_member = models.Member(
        id=uuid.uuid4(),
        user_id=viewer_user.id,
        organization_id=org1.id,
        role="viewer",
    )
    db.add(viewer_member)

    # User with no memberships
    orphan_user = models.User(
        id=uuid.uuid4(),
        email=f"orphan_{uuid.uuid4().hex[:6]}@rbac.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(orphan_user)

    # 2. Organization 2
    org2 = models.Organization(id=uuid.uuid4(), name="RBAC Test Corp 2")
    db.add(org2)
    db.commit()

    org2_admin = models.User(
        id=uuid.uuid4(),
        email=f"org2_admin_{uuid.uuid4().hex[:6]}@other.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(org2_admin)
    db.commit()
    org2_member = models.Member(
        id=uuid.uuid4(),
        user_id=org2_admin.id,
        organization_id=org2.id,
        role="admin",
    )
    db.add(org2_member)

    # 3. Policy & Versions for Org 1
    policy1 = models.Policy(
        id=uuid.uuid4(),
        organization_id=org1.id,
        name="Org 1 Baseline Policy",
    )
    db.add(policy1)
    db.commit()

    rules_dict = {"checks": {"firewall": {"enabled": True, "required": True}}}
    def_json = json.dumps(rules_dict)
    h1 = hashlib.sha256(def_json.encode('utf-8')).hexdigest()

    ver1 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy1.id,
        version_number=1,
        definition_json=def_json,
        content=def_json,
        content_hash=h1,
        status="PUBLISHED",
        created_by=owner_user.id,
    )
    db.add(ver1)
    db.commit()
    policy1.active_version_id = ver1.id

    assignment1 = models.PolicyAssignment(
        id=uuid.uuid4(),
        organization_id=org1.id,
        policy_id=policy1.id,
        device_id=None,
    )
    db.add(assignment1)
    db.commit()

    ver2 = models.PolicyVersion(
        id=uuid.uuid4(),
        policy_id=policy1.id,
        version_number=2,
        definition_json=def_json,
        content=def_json,
        status="DRAFT",
        created_by=owner_user.id,
    )
    db.add(ver2)
    db.commit()

    # 4. Device for Org 1
    device1 = models.Device(
        id=uuid.uuid4(),
        organization_id=org1.id,
        hostname="workstation-rbac-01",
        os_name="ubuntu",
        os_version="22.04",
        os_arch="amd64",
        kernel_version="6.5.0-generic",
        agent_version="1.0.0",
        status="ONLINE",
        compliance_status="PASS",
        compliance_score=100,
        device_token=f"dev_token_{uuid.uuid4().hex}",
    )
    db.add(device1)

    # 5. Finding for Org 1
    finding1 = models.Finding(
        id=uuid.uuid4(),
        device_id=device1.id,
        policy_id=policy1.id,
        rule_id="firewall",
        check_name="Host Firewall",
        severity="HIGH",
        status="OPEN",
        reason="UFW inactive",
    )
    db.add(finding1)

    # 6. Webhook for Org 1
    webhook1 = models.Webhook(
        id=uuid.uuid4(),
        organization_id=org1.id,
        name="Org 1 Security Alerts",
        endpoint_url="https://api.example.com/sec-alerts",
        signing_secret="supersecret32byteshexkey12345678",
        enabled=True,
    )
    db.add(webhook1)

    db.commit()

    # Generate JWT access tokens
    owner_token = security.create_access_token(owner_user.email)
    admin_token = security.create_access_token(admin_user.email)
    viewer_token = security.create_access_token(viewer_user.email)
    orphan_token = security.create_access_token(orphan_user.email)
    org2_token = security.create_access_token(org2_admin.email)

    return {
        "org1": org1,
        "org2": org2,
        "owner_token": owner_token,
        "admin_token": admin_token,
        "viewer_token": viewer_token,
        "orphan_token": orphan_token,
        "org2_token": org2_token,
        "policy1": policy1,
        "ver1": ver1,
        "ver2": ver2,
        "device1": device1,
        "finding1": finding1,
        "webhook1": webhook1,
    }


def test_viewer_read_endpoints_allowed(client, db):
    """
    Verifies that a user with VIEWER role can successfully read all query views.
    """
    data = setup_rbac_data(db)
    token = data["viewer_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Devices list
    res = client.get("/api/v1/devices", headers=headers)
    assert res.status_code == 200

    # 2. Device detail
    dev_id = data["device1"].id
    res = client.get(f"/api/v1/devices/{dev_id}", headers=headers)
    assert res.status_code == 200

    # 3. Policies list
    res = client.get("/api/v1/policies", headers=headers)
    assert res.status_code == 200

    # 4. Policy versions
    pol_id = data["policy1"].id
    res = client.get(f"/api/v1/policies/{pol_id}/versions", headers=headers)
    assert res.status_code == 200

    # 5. Findings list & summary & detail
    res = client.get("/api/v1/findings", headers=headers)
    assert res.status_code == 200
    res = client.get("/api/v1/findings/summary", headers=headers)
    assert res.status_code == 200
    f_id = data["finding1"].id
    res = client.get(f"/api/v1/findings/{f_id}", headers=headers)
    assert res.status_code == 200

    # 6. Compliance summary & controls & evidence
    res = client.get("/api/v1/compliance/summary", headers=headers)
    assert res.status_code == 200
    res = client.get("/api/v1/compliance/controls", headers=headers)
    assert res.status_code == 200
    res = client.get("/api/v1/compliance/evidence", headers=headers)
    assert res.status_code == 200

    # 7. Events
    res = client.get("/api/v1/events", headers=headers)
    assert res.status_code == 200

    # 8. Webhooks
    res = client.get("/api/v1/webhooks", headers=headers)
    assert res.status_code == 200


def test_viewer_finding_mutations_blocked_with_403(client, db):
    """
    Verifies that a user with VIEWER role receives HTTP 403 Forbidden
    when attempting finding lifecycle actions (acknowledge, remediation, waiver).
    """
    data = setup_rbac_data(db)
    token = data["viewer_token"]
    headers = {"Authorization": f"Bearer {token}"}
    f_id = data["finding1"].id

    # 1. Acknowledge -> 403
    ack_res = client.post(f"/api/v1/findings/{f_id}/acknowledge", headers=headers)
    assert ack_res.status_code == 403
    assert "Forbidden" in ack_res.json()["detail"]

    # 2. Remediation -> 403
    rem_res = client.post(
        f"/api/v1/findings/{f_id}/remediation",
        headers=headers,
        json={"note": "Viewer unauthorized attempt"}
    )
    assert rem_res.status_code == 403

    # 3. Waiver -> 403
    future_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat() + "Z"
    waive_res = client.post(
        f"/api/v1/findings/{f_id}/waive",
        headers=headers,
        json={
            "reason": "Viewer unauthorized waiver",
            "expires_at": future_date,
            "owner": "viewer@rbac.corp"
        }
    )
    assert waive_res.status_code == 403


def test_viewer_policy_mutations_blocked_with_403(client, db):
    """
    Verifies that a user with VIEWER role receives HTTP 403 Forbidden
    when attempting policy mutations (save, create version, publish, activate, rollback).
    """
    data = setup_rbac_data(db)
    token = data["viewer_token"]
    headers = {"Authorization": f"Bearer {token}"}
    pol_id = data["policy1"].id
    ver2_id = data["ver2"].id
    ver1_id = data["ver1"].id

    # 1. Save policy YAML -> 403
    save_res = client.post(
        "/api/v1/policies",
        headers=headers,
        json={"rules_yaml": "checks:\n  firewall:\n    enabled: true\n"}
    )
    assert save_res.status_code == 403

    # 2. Create version -> 403
    ver_res = client.post(
        f"/api/v1/policies/{pol_id}/versions?rules_json={{}}",
        headers=headers
    )
    assert ver_res.status_code == 403

    # 3. Publish version -> 403
    pub_res = client.post(
        f"/api/v1/policies/{pol_id}/versions/{ver2_id}/publish",
        headers=headers
    )
    assert pub_res.status_code == 403

    # 4. Activate version -> 403
    act_res = client.post(
        f"/api/v1/policies/{pol_id}/activate?version_id={ver1_id}",
        headers=headers
    )
    assert act_res.status_code == 403

    # 5. Rollback version -> 403
    rb_res = client.post(
        f"/api/v1/policies/{pol_id}/rollback?target_version_id={ver1_id}",
        headers=headers
    )
    assert rb_res.status_code == 403

    # 6. Assign default policy -> 403
    ass_res = client.post(
        f"/api/v1/policies/{pol_id}/assign-default",
        headers=headers
    )
    assert ass_res.status_code == 403


def test_viewer_operational_mutations_blocked_with_403(client, db):
    """
    Verifies that a user with VIEWER role receives HTTP 403 Forbidden
    when attempting token generation, webhook management, or device decommissioning.
    """
    data = setup_rbac_data(db)
    token = data["viewer_token"]
    headers = {"Authorization": f"Bearer {token}"}
    dev_id = data["device1"].id
    hook_id = data["webhook1"].id

    # 1. Create enrollment token -> 403
    exp_time = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    tok_res = client.post(
        "/api/v1/enrollment-tokens",
        headers=headers,
        json={"expires_at": exp_time}
    )
    assert tok_res.status_code == 403

    # 2. Decommission device -> 403
    dec_res = client.post(f"/api/v1/devices/{dev_id}/decommission", headers=headers)
    assert dec_res.status_code == 403

    # 3. Create webhook -> 403
    wh_res = client.post(
        "/api/v1/webhooks",
        headers=headers,
        json={
            "name": "Viewer Hook",
            "endpoint_url": "https://api.example.com/viewer-hook",
            "events": ["VIOLATION_TRIGGERED"]
        }
    )
    assert wh_res.status_code == 403

    # 4. Update webhook -> 403
    wh_up = client.patch(
        f"/api/v1/webhooks/{hook_id}",
        headers=headers,
        json={"name": "New Name"}
    )
    assert wh_up.status_code == 403

    # 5. Delete webhook -> 403
    wh_del = client.delete(f"/api/v1/webhooks/{hook_id}", headers=headers)
    assert wh_del.status_code == 403

    # 6. Test webhook -> 403
    wh_test = client.post(f"/api/v1/webhooks/{hook_id}/test", headers=headers)
    assert wh_test.status_code == 403

    # 7. Retention cleanup -> 403
    maint_res = client.post("/api/v1/maintenance/cleanup-checkruns", headers=headers)
    assert maint_res.status_code == 403


def test_admin_and_owner_mutations_allowed(client, db):
    """
    Verifies that users with ADMIN or OWNER role can perform operational mutations.
    """
    data = setup_rbac_data(db)
    admin_token = data["admin_token"]
    owner_token = data["owner_token"]
    f_id = data["finding1"].id

    # 1. Admin can acknowledge finding
    ack_res = client.post(
        f"/api/v1/findings/{f_id}/acknowledge",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # 2. Admin can start remediation
    rem_res = client.post(
        f"/api/v1/findings/{f_id}/remediation",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"note": "SecOps admin investigating"}
    )
    assert rem_res.status_code == 200
    assert rem_res.json()["status"] == "IN_REMEDIATION"

    # 3. Owner can grant waiver
    future_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat() + "Z"
    waive_res = client.post(
        f"/api/v1/findings/{f_id}/waive",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "reason": "Executive maintenance exception",
            "expires_at": future_date,
            "owner": "owner@rbac.corp"
        }
    )
    assert waive_res.status_code == 200
    assert waive_res.json()["status"] == "WAIVED"

    # 4. Admin can generate enrollment token
    exp_time = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    tok_res = client.post(
        "/api/v1/enrollment-tokens",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"expires_at": exp_time}
    )
    assert tok_res.status_code == 200
    assert "token_hash" in tok_res.json()


def test_user_without_memberships_forbidden(client, db):
    """
    Verifies that an authenticated user who has no organization membership
    is blocked from accessing administrative routes.
    """
    data = setup_rbac_data(db)
    token = data["orphan_token"]
    headers = {"Authorization": f"Bearer {token}"}
    f_id = data["finding1"].id

    ack_res = client.post(f"/api/v1/findings/{f_id}/acknowledge", headers=headers)
    assert ack_res.status_code == 403
    assert "No active organization membership" in ack_res.json()["detail"]


def test_cross_tenant_isolation_preserved(client, db):
    """
    Verifies that an Admin in Org 2 cannot mutate resources belonging to Org 1.
    """
    data = setup_rbac_data(db)
    org2_token = data["org2_token"]
    headers = {"Authorization": f"Bearer {org2_token}"}
    f1_id = data["finding1"].id
    dev1_id = data["device1"].id
    wh1_id = data["webhook1"].id

    # 1. Finding acknowledge on Org 1 finding -> 404 (tenant-scoped)
    ack_res = client.post(f"/api/v1/findings/{f1_id}/acknowledge", headers=headers)
    assert ack_res.status_code == 404

    # 2. Decommission Org 1 device -> 404
    dec_res = client.post(f"/api/v1/devices/{dev1_id}/decommission", headers=headers)
    assert dec_res.status_code == 404

    # 3. Delete Org 1 webhook -> 404
    del_res = client.delete(f"/api/v1/webhooks/{wh1_id}", headers=headers)
    assert del_res.status_code == 404


def test_agent_telemetry_not_blocked_by_human_rbac(client, db):
    """
    Verifies that endpoint agent registration and check-in continue functioning
    without interference from human user RBAC dependencies.
    """
    data = setup_rbac_data(db)
    dev = data["device1"]
    ver = data["ver1"]

    headers = {
        "device-uuid": str(dev.id),
        "x-device-token": dev.device_token,
    }

    # Heartbeat
    hb_res = client.post("/api/v1/agent/heartbeat", headers=headers)
    assert hb_res.status_code == 200

    # Policy fetch
    pol_res = client.get("/api/v1/agent/policy", headers=headers)
    assert pol_res.status_code == 200
    assert (
        pol_res.json()["content_hash"].replace("sha256:", "") ==
        ver.content_hash.replace("sha256:", "")
    )

    # Check-in
    checkin_res = client.post(
        "/api/v1/agent/checkin",
        headers=headers,
        json={
            "id": str(uuid.uuid4()),
            "status": "PASS",
            "score": 100,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "policy_version_id": str(ver.id),
            "content_hash": ver.content_hash,
            "findings": []
        }
    )
    assert checkin_res.status_code == 200
