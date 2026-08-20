import uuid
from app.core import security
from app.models import models


def setup_team_test_data(db):
    """
    Sets up two isolated organizations with:
    - Org 1:
      - Owner user
      - Admin user
      - Viewer user
      - Policy with 1 published version
      - 1 Enrolled device
    - Org 2:
      - Owner user in Org 2
      - Viewer user in Org 2
    """
    # 1. Organization 1
    org1 = models.Organization(id=uuid.uuid4(), name="Acme Security Corp")
    db.add(org1)

    owner1 = models.User(
        id=uuid.uuid4(),
        email=f"owner_{uuid.uuid4().hex[:6]}@acme.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(owner1)
    db.commit()
    m_owner1 = models.Member(
        id=uuid.uuid4(),
        user_id=owner1.id,
        organization_id=org1.id,
        role="owner",
    )
    db.add(m_owner1)

    admin1 = models.User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@acme.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(admin1)
    db.commit()
    m_admin1 = models.Member(
        id=uuid.uuid4(),
        user_id=admin1.id,
        organization_id=org1.id,
        role="admin",
    )
    db.add(m_admin1)

    viewer1 = models.User(
        id=uuid.uuid4(),
        email=f"viewer_{uuid.uuid4().hex[:6]}@acme.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(viewer1)
    db.commit()
    m_viewer1 = models.Member(
        id=uuid.uuid4(),
        user_id=viewer1.id,
        organization_id=org1.id,
        role="viewer",
    )
    db.add(m_viewer1)

    # 2. Organization 2
    org2 = models.Organization(id=uuid.uuid4(), name="Beta Technologies")
    db.add(org2)

    owner2 = models.User(
        id=uuid.uuid4(),
        email=f"owner_{uuid.uuid4().hex[:6]}@beta.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(owner2)
    db.commit()
    m_owner2 = models.Member(
        id=uuid.uuid4(),
        user_id=owner2.id,
        organization_id=org2.id,
        role="owner",
    )
    db.add(m_owner2)

    viewer2 = models.User(
        id=uuid.uuid4(),
        email=f"viewer_{uuid.uuid4().hex[:6]}@beta.corp",
        hashed_password=security.get_password_hash("SecretPass123!"),
    )
    db.add(viewer2)
    db.commit()
    m_viewer2 = models.Member(
        id=uuid.uuid4(),
        user_id=viewer2.id,
        organization_id=org2.id,
        role="viewer",
    )
    db.add(m_viewer2)

    db.commit()

    return {
        "org1": org1,
        "owner1": owner1,
        "m_owner1": m_owner1,
        "admin1": admin1,
        "m_admin1": m_admin1,
        "viewer1": viewer1,
        "m_viewer1": m_viewer1,
        "owner1_token": security.create_access_token(owner1.email),
        "admin1_token": security.create_access_token(admin1.email),
        "viewer1_token": security.create_access_token(viewer1.email),
        "org2": org2,
        "owner2": owner2,
        "m_owner2": m_owner2,
        "viewer2": viewer2,
        "m_viewer2": m_viewer2,
        "owner2_token": security.create_access_token(owner2.email),
    }


def test_organization_profile_read(client, db):
    """
    Verifies that Viewer, Admin, and Owner can all read the organization profile.
    """
    data = setup_team_test_data(db)

    # 1. Viewer read
    res_v = client.get(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['viewer1_token']}"}
    )
    assert res_v.status_code == 200
    p_v = res_v.json()
    assert p_v["name"] == "Acme Security Corp"
    assert p_v["member_count"] == 3
    assert p_v["current_user_role"] == "viewer"

    # 2. Admin read
    res_a = client.get(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['admin1_token']}"}
    )
    assert res_a.status_code == 200
    assert res_a.json()["current_user_role"] == "admin"

    # 3. Owner read
    res_o = client.get(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['owner1_token']}"}
    )
    assert res_o.status_code == 200
    assert res_o.json()["current_user_role"] == "owner"


def test_organization_profile_update_rbac(client, db):
    """
    Verifies that only Owner can modify the organization profile.
    Viewer and Admin attempts must return HTTP 403.
    """
    data = setup_team_test_data(db)

    # 1. Viewer attempt -> 403
    res_v = client.patch(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['viewer1_token']}"},
        json={"name": "Hacked Name"}
    )
    assert res_v.status_code == 403

    # 2. Admin attempt -> 403
    res_a = client.patch(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['admin1_token']}"},
        json={"name": "Admin Rename Attempt"}
    )
    assert res_a.status_code == 403

    # 3. Owner update -> 200
    res_o = client.patch(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"name": "Acme Global Security Inc"}
    )
    assert res_o.status_code == 200
    assert res_o.json()["name"] == "Acme Global Security Inc"


def test_team_member_directory_listing(client, db):
    """
    Verifies that Viewer, Admin, and Owner can view the organization members list.
    """
    data = setup_team_test_data(db)

    # Viewer list members
    res = client.get(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['viewer1_token']}"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    emails = [item["email"] for item in body["items"]]
    assert data["owner1"].email in emails
    assert data["admin1"].email in emails
    assert data["viewer1"].email in emails


def test_add_member_rbac_and_lifecycle(client, db):
    """
    Verifies that only Owner can add new members (admin/viewer).
    Viewer and Admin attempts return 403.
    """
    data = setup_team_test_data(db)
    new_email = f"new_{uuid.uuid4().hex[:6]}@acme.corp"

    # 1. Viewer attempt -> 403
    res_v = client.post(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['viewer1_token']}"},
        json={"email": new_email, "role": "viewer"}
    )
    assert res_v.status_code == 403

    # 2. Admin attempt -> 403
    res_a = client.post(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['admin1_token']}"},
        json={"email": new_email, "role": "viewer"}
    )
    assert res_a.status_code == 403

    # 3. Owner cannot create another Owner -> 400
    res_o_invalid = client.post(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"email": new_email, "role": "owner"}
    )
    assert res_o_invalid.status_code == 400

    # 4. Owner adds new member -> 200
    res_o = client.post(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"email": new_email, "role": "admin"}
    )
    assert res_o.status_code == 200
    added = res_o.json()
    assert added["email"] == new_email
    assert added["role"] == "admin"

    # 5. Duplicate addition attempt -> 409 Conflict
    res_dup = client.post(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"email": new_email, "role": "admin"}
    )
    assert res_dup.status_code == 409


def test_member_role_management_and_last_owner_protection(client, db):
    """
    Verifies role change workflow (admin <-> viewer) and enforces
    that the last remaining Owner cannot be demoted.
    """
    data = setup_team_test_data(db)
    m_admin = data["m_admin1"]
    m_owner = data["m_owner1"]

    # 1. Viewer attempt -> 403
    res_v = client.patch(
        f"/api/v1/org/members/{m_admin.id}",
        headers={"Authorization": f"Bearer {data['viewer1_token']}"},
        json={"role": "viewer"}
    )
    assert res_v.status_code == 403

    # 2. Admin attempt -> 403
    res_a = client.patch(
        f"/api/v1/org/members/{m_admin.id}",
        headers={"Authorization": f"Bearer {data['admin1_token']}"},
        json={"role": "viewer"}
    )
    assert res_a.status_code == 403

    # 3. Owner updates admin to viewer -> 200
    res_o = client.patch(
        f"/api/v1/org/members/{m_admin.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"role": "viewer"}
    )
    assert res_o.status_code == 200
    assert res_o.json()["role"] == "viewer"

    # 4. Owner cannot promote member to Owner -> 400
    res_promo = client.patch(
        f"/api/v1/org/members/{m_admin.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"role": "owner"}
    )
    assert res_promo.status_code == 400

    # 5. Owner Safety: Cannot demote the sole remaining Owner -> 400
    res_demote = client.patch(
        f"/api/v1/org/members/{m_owner.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"role": "admin"}
    )
    assert res_demote.status_code == 400
    assert "Cannot demote the last remaining owner" in res_demote.json()["detail"]


def test_member_removal_and_account_preservation(client, db):
    """
    Verifies member removal by Owner, safety against removing the last Owner,
    and guarantees the underlying User account is NOT deleted.
    """
    data = setup_team_test_data(db)
    m_viewer = data["m_viewer1"]
    m_owner = data["m_owner1"]
    viewer_user_id = data["viewer1"].id

    # 1. Viewer attempt -> 403
    res_v = client.delete(
        f"/api/v1/org/members/{m_viewer.id}",
        headers={"Authorization": f"Bearer {data['viewer1_token']}"}
    )
    assert res_v.status_code == 403

    # 2. Admin attempt -> 403
    res_a = client.delete(
        f"/api/v1/org/members/{m_viewer.id}",
        headers={"Authorization": f"Bearer {data['admin1_token']}"}
    )
    assert res_a.status_code == 403

    # 3. Owner Safety: Cannot remove sole remaining Owner -> 400
    res_del_owner = client.delete(
        f"/api/v1/org/members/{m_owner.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"}
    )
    assert res_del_owner.status_code == 400
    assert "Cannot remove the last remaining owner" in res_del_owner.json()["detail"]

    # 4. Owner removes viewer -> 200
    res_o = client.delete(
        f"/api/v1/org/members/{m_viewer.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"}
    )
    assert res_o.status_code == 200
    assert res_o.json()["status"] == "removed"

    # 5. Verify Member is deleted from DB
    deleted_m = db.query(models.Member).filter(models.Member.id == m_viewer.id).first()
    assert deleted_m is None

    # 6. Verify User account STILL EXISTS (Account preservation invariant)
    user_still_exists = db.query(models.User).filter(models.User.id == viewer_user_id).first()
    assert user_still_exists is not None


def test_cross_tenant_isolation(client, db):
    """
    Verifies that Owner in Org 1 cannot view, modify, or delete members in Org 2.
    """
    data = setup_team_test_data(db)
    m_org2_viewer = data["m_viewer2"]

    # 1. Org 1 Owner attempting to modify Org 2 member -> 404 (scoped out)
    res_mod = client.patch(
        f"/api/v1/org/members/{m_org2_viewer.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"role": "admin"}
    )
    assert res_mod.status_code == 404

    # 2. Org 1 Owner attempting to delete Org 2 member -> 404
    res_del = client.delete(
        f"/api/v1/org/members/{m_org2_viewer.id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"}
    )
    assert res_del.status_code == 404

    # 3. Org 1 Owner listing members does not leak Org 2 members
    res_list = client.get(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['owner1_token']}"}
    )
    assert res_list.status_code == 200
    emails = [item["email"] for item in res_list.json()["items"]]
    assert data["viewer2"].email not in emails
    assert data["owner2"].email not in emails


def test_team_admin_audit_events(client, db):
    """
    Verifies that organization profile edits and member additions, role changes,
    and removals emit audit events into the database.
    """
    data = setup_team_test_data(db)
    new_email = f"audited_{uuid.uuid4().hex[:6]}@acme.corp"

    # 1. Update Org Name
    client.patch(
        "/api/v1/org/profile",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"name": "Acme Audited Corp"}
    )

    # 2. Add Member
    res_add = client.post(
        "/api/v1/org/members",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"email": new_email, "role": "viewer"}
    )
    new_m_id = res_add.json()["id"]

    # 3. Role Change
    client.patch(
        f"/api/v1/org/members/{new_m_id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"},
        json={"role": "admin"}
    )

    # 4. Remove Member
    client.delete(
        f"/api/v1/org/members/{new_m_id}",
        headers={"Authorization": f"Bearer {data['owner1_token']}"}
    )

    # 5. Check events in DB
    events = (
        db.query(models.Event)
        .filter(models.Event.type.in_([
            "ORGANIZATION_UPDATED",
            "MEMBER_ADDED",
            "MEMBER_ROLE_CHANGED",
            "MEMBER_REMOVED",
        ]))
        .all()
    )
    event_types = [e.type for e in events]
    assert "ORGANIZATION_UPDATED" in event_types
    assert "MEMBER_ADDED" in event_types
    assert "MEMBER_ROLE_CHANGED" in event_types
    assert "MEMBER_REMOVED" in event_types
