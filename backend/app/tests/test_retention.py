import uuid
from datetime import datetime, timedelta
from app.models import models
from app.core import security


def create_test_tenant(db, name="Retention Corp", email="retention_admin@flientsec.local"):
    org = models.Organization(id=uuid.uuid4(), name=name)
    db.add(org)
    user = models.User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4().hex[:6]}_{email}",
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


def test_cleanup_preserves_recent_runs_and_deletes_expired(client, db):
    org, user, headers = create_test_tenant(db, name="Alpha Retention")
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Device-Ret-1",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2",
        agent_version="1.0.0", status="ONLINE", compliance_status="PASS", compliance_score=100
    )
    db.add(device)
    db.commit()

    # 3 Recent Runs (within 30 days)
    recent_ids = []
    for i in range(3):
        r_id = uuid.uuid4()
        run = models.CheckRun(
            id=r_id, device_id=device.id, status="PASS", score=100,
            timestamp=datetime.utcnow() - timedelta(days=i * 5)
        )
        db.add(run)
        recent_ids.append(r_id)

    # 4 Expired Runs (older than 30 days: 35, 40, 45, 50 days ago)
    expired_ids = []
    for i in range(4):
        e_id = uuid.uuid4()
        run = models.CheckRun(
            id=e_id, device_id=device.id, status="PASS", score=100,
            timestamp=datetime.utcnow() - timedelta(days=35 + i * 5)
        )
        db.add(run)
        expired_ids.append(e_id)

    db.commit()

    # Trigger cleanup with 30-day retention
    resp = client.post("/api/v1/maintenance/cleanup-checkruns?retention_days=30", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["deleted_count"] == 4

    # Verify recent runs still exist
    for r_id in recent_ids:
        assert db.query(models.CheckRun).filter(models.CheckRun.id == r_id).first() is not None

    # Verify expired runs are purged
    for e_id in expired_ids:
        assert db.query(models.CheckRun).filter(models.CheckRun.id == e_id).first() is None


def test_cleanup_preserves_findings_and_events(client, db):
    org, user, headers = create_test_tenant(db, name="Beta Retention")
    policy = models.Policy(id=uuid.uuid4(), organization_id=org.id, name="Retention Policy")
    db.add(policy)
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Device-Ret-2",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2",
        agent_version="1.0.0", status="ONLINE", compliance_status="FAIL", compliance_score=60
    )
    db.add(device)
    finding = models.Finding(
        id=uuid.uuid4(), device_id=device.id, policy_id=policy.id,
        rule_id="rule.firewall", check_name="firewall.enabled", severity="HIGH", status="OPEN"
    )
    db.add(finding)
    event = models.Event(
        id=uuid.uuid4(), device_id=device.id, type="VIOLATION_TRIGGERED",
        rule_name="rule.firewall", message="Firewall violation", finding_id=finding.id
    )
    db.add(event)

    finding_id = finding.id
    event_id = event.id

    # Add expired run
    old_run = models.CheckRun(
        id=uuid.uuid4(), device_id=device.id, status="FAIL", score=60,
        timestamp=datetime.utcnow() - timedelta(days=60)
    )
    db.add(old_run)
    db.commit()

    # Trigger cleanup
    resp = client.post("/api/v1/maintenance/cleanup-checkruns?retention_days=30", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted_count"] == 1

    # Finding and Event remain fully intact
    assert db.query(models.Finding).filter(models.Finding.id == finding_id).first() is not None
    assert db.query(models.Event).filter(models.Event.id == event_id).first() is not None


def test_cleanup_tenant_isolation(client, db):
    org_a, user_a, headers_a = create_test_tenant(db, name="Tenant A Ret")
    org_b, user_b, headers_b = create_test_tenant(db, name="Tenant B Ret")

    dev_a = models.Device(
        id=uuid.uuid4(), organization_id=org_a.id, hostname="Dev-A",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2",
        agent_version="1.0.0", status="ONLINE"
    )
    dev_b = models.Device(
        id=uuid.uuid4(), organization_id=org_b.id, hostname="Dev-B",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2",
        agent_version="1.0.0", status="ONLINE"
    )
    db.add(dev_a)
    db.add(dev_b)

    run_a_id = uuid.uuid4()
    run_b_id = uuid.uuid4()

    run_a = models.CheckRun(
        id=run_a_id, device_id=dev_a.id, status="PASS", score=100,
        timestamp=datetime.utcnow() - timedelta(days=50)
    )
    run_b = models.CheckRun(
        id=run_b_id, device_id=dev_b.id, status="PASS", score=100,
        timestamp=datetime.utcnow() - timedelta(days=50)
    )
    db.add(run_a)
    db.add(run_b)
    db.commit()

    # Tenant A triggers cleanup -> deletes run_a only, preserves run_b
    resp = client.post("/api/v1/maintenance/cleanup-checkruns?retention_days=30", headers=headers_a)
    assert resp.status_code == 200
    assert resp.json()["deleted_count"] == 1

    assert db.query(models.CheckRun).filter(models.CheckRun.id == run_a_id).first() is None
    assert db.query(models.CheckRun).filter(models.CheckRun.id == run_b_id).first() is not None


def test_cleanup_batch_limit_and_idempotency(client, db):
    org, user, headers = create_test_tenant(db, name="Gamma Retention")
    device = models.Device(
        id=uuid.uuid4(), organization_id=org.id, hostname="Dev-Batch",
        os_name="Linux", os_version="Ubuntu", os_arch="x86_64", kernel_version="6.2",
        agent_version="1.0.0", status="ONLINE"
    )
    db.add(device)

    for i in range(5):
        run = models.CheckRun(
            id=uuid.uuid4(), device_id=device.id, status="PASS", score=100,
            timestamp=datetime.utcnow() - timedelta(days=40 + i)
        )
        db.add(run)
    db.commit()

    # Request batch_size=2
    resp1 = client.post(
        "/api/v1/maintenance/cleanup-checkruns?retention_days=30&batch_size=2",
        headers=headers
    )
    assert resp1.status_code == 200
    assert resp1.json()["deleted_count"] == 2

    # Next batch
    resp2 = client.post(
        "/api/v1/maintenance/cleanup-checkruns?retention_days=30&batch_size=10",
        headers=headers
    )
    assert resp2.status_code == 200
    assert resp2.json()["deleted_count"] == 3

    # Running again when 0 expired -> returns 0 safely
    resp3 = client.post(
        "/api/v1/maintenance/cleanup-checkruns?retention_days=30",
        headers=headers
    )
    assert resp3.status_code == 200
    assert resp3.json()["deleted_count"] == 0
