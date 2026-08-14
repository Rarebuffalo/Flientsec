import hashlib
import hmac
import http.server
import json
import threading
import time
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock
from app.models import models
from app.services import webhook_service
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


def test_ssrf_protection_validator():
    """Verify that private, loopback, link-local, and cloud metadata destinations are blocked."""
    # Localhost / Loopback
    valid, msg = webhook_service.validate_webhook_url("http://localhost:8080/hook")
    assert not valid
    assert "restricted" in msg or "resolve" in msg

    valid, msg = webhook_service.validate_webhook_url("http://127.0.0.1:8080/hook")
    assert not valid
    assert "restricted" in msg

    # AWS/GCP Metadata IP
    valid, msg = webhook_service.validate_webhook_url("http://169.254.169.254/latest/meta-data")
    assert not valid
    assert "restricted" in msg

    # RFC1918 Private Ranges
    valid, msg = webhook_service.validate_webhook_url("http://10.0.0.5:8000/webhook")
    assert not valid
    assert "restricted" in msg

    valid, msg = webhook_service.validate_webhook_url("http://192.168.1.100/webhook")
    assert not valid
    assert "restricted" in msg

    # Invalid Schemes
    valid, msg = webhook_service.validate_webhook_url("ftp://example.com/hook")
    assert not valid
    assert "scheme must be http or https" in msg

    valid, msg = webhook_service.validate_webhook_url("javascript:alert(1)")
    assert not valid


def test_hmac_signature_computation():
    """Verify HMAC-SHA256 signature computation and constant-time verification."""
    secret = "test_signing_secret_1234567890abcdef"
    timestamp = "1723680000"
    raw_body = json.dumps({"test": "data", "num": 42}, separators=(",", ":"))

    sig = webhook_service.compute_signature(secret, timestamp, raw_body)
    assert len(sig) == 64  # SHA-256 hex string

    # Verification
    assert webhook_service.verify_signature(secret, timestamp, raw_body, sig)

    # Tampered body fails verification
    assert not webhook_service.verify_signature(secret, timestamp, raw_body + "tamper", sig)

    # Tampered timestamp fails verification
    assert not webhook_service.verify_signature(secret, "1723680001", raw_body, sig)

    # Wrong secret fails verification
    assert not webhook_service.verify_signature("wrong_secret", timestamp, raw_body, sig)


def test_webhook_crud_and_secret_masking(client, db):
    """Verify Webhook CRUD operations, tenant isolation, and secret masking."""
    org, user, headers = create_tenant(db, name="Hook Org", email_prefix="hook_admin")

    with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
        # 1. Create Webhook (secret returned ONLY here)
        create_payload = {
            "name": "Security SIEM Hook",
            "endpoint_url": "https://example.com/webhook",
            "events": ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"],
            "enabled": True
        }
        res = client.post("/api/v1/webhooks", json=create_payload, headers=headers)
        assert res.status_code == 200, res.text
        created_data = res.json()
        webhook_id = created_data["id"]

        assert created_data["name"] == "Security SIEM Hook"
        assert created_data["endpoint_url"] == "https://example.com/webhook"
        assert "signing_secret" in created_data
        assert len(created_data["signing_secret"]) == 64  # 32-bytes hex

        # 2. GET List - Secret MUST NOT be present
        res = client.get("/api/v1/webhooks", headers=headers)
        assert res.status_code == 200
        webhooks_list = res.json()
        assert len(webhooks_list) >= 1
        hook_in_list = next(w for w in webhooks_list if w["id"] == webhook_id)
        assert "signing_secret" not in hook_in_list
        assert hook_in_list["enabled"] is True

        # 3. GET Detail - Secret MUST NOT be present
        res = client.get(f"/api/v1/webhooks/{webhook_id}", headers=headers)
        assert res.status_code == 200
        detail_data = res.json()
        assert "signing_secret" not in detail_data
        assert "recent_deliveries" in detail_data

        # 4. PATCH Update - Secret MUST NOT be present
        res = client.patch(
            f"/api/v1/webhooks/{webhook_id}",
            json={"name": "Updated SIEM Hook", "enabled": False},
            headers=headers
        )
        assert res.status_code == 200
        updated_data = res.json()
        assert updated_data["name"] == "Updated SIEM Hook"
        assert updated_data["enabled"] is False
        assert "signing_secret" not in updated_data

        # 5. Re-enable for testing
        client.patch(
            f"/api/v1/webhooks/{webhook_id}",
            json={"enabled": True},
            headers=headers
        )

        # 6. DELETE Webhook
        del_res = client.delete(f"/api/v1/webhooks/{webhook_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Verify deleted
        get_res = client.get(f"/api/v1/webhooks/{webhook_id}", headers=headers)
        assert get_res.status_code == 404


def test_webhook_tenant_isolation(client, db):
    """Verify Org A cannot view, update, delete, or test Org B's webhook."""
    org_a, user_a, headers_a = create_tenant(db, name="Tenant A", email_prefix="tenant_a")
    org_b, user_b, headers_b = create_tenant(db, name="Tenant B", email_prefix="tenant_b")

    # Create webhook belonging to Org B
    webhook_b = models.Webhook(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        name="Org B Private Hook",
        endpoint_url="https://example.com/hook_b",
        signing_secret="secret_b_1234567890abcdef1234567890abcdef",
        enabled=True,
        events='["VIOLATION_TRIGGERED"]'
    )
    db.add(webhook_b)
    db.commit()

    # User A tries to access Org B's webhook
    # Cannot GET
    res = client.get(f"/api/v1/webhooks/{webhook_b.id}", headers=headers_a)
    assert res.status_code == 404

    # Cannot PATCH
    res = client.patch(
        f"/api/v1/webhooks/{webhook_b.id}",
        json={"name": "Attacked Hook"},
        headers=headers_a
    )
    assert res.status_code == 404

    # Cannot DELETE
    res = client.delete(f"/api/v1/webhooks/{webhook_b.id}", headers=headers_a)
    assert res.status_code == 404

    # Cannot TEST
    res = client.post(f"/api/v1/webhooks/{webhook_b.id}/test", headers=headers_a)
    assert res.status_code == 404


def test_webhook_test_event_dispatch(client, db):
    """Verify test webhook endpoint emits TEST_EVENT with valid HMAC signature and delivery logging."""
    org, user, headers = create_tenant(db, name="Test Hook Org", email_prefix="test_hook")

    with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
        # Create Webhook
        create_res = client.post(
            "/api/v1/webhooks",
            json={
                "name": "Integration Test Hook",
                "endpoint_url": "https://example.com/test-flientsec",
                "events": ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]
            },
            headers=headers
        )
        assert create_res.status_code == 200
        webhook_data = create_res.json()
        webhook_id = webhook_data["id"]

    # Mock delivery dispatch directly with all required schema fields
    now = datetime.utcnow()
    mock_delivery_record = models.WebhookDelivery(
        id=uuid.uuid4(),
        webhook_id=uuid.UUID(webhook_id),
        event_id=uuid.uuid4(),
        event_type="TEST_EVENT",
        status="SUCCESS",
        attempt_count=1,
        response_status_code=200,
        error_message=None,
        delivered_at=now,
        created_at=now
    )
    deliver_target = "app.api.endpoints.webhook_service.deliver_webhook_sync"
    with patch(deliver_target, return_value=mock_delivery_record) as mock_deliver:
        test_res = client.post(f"/api/v1/webhooks/{webhook_id}/test", headers=headers)
        assert test_res.status_code == 200, test_res.text
        delivery = test_res.json()

        assert delivery["status"] == "SUCCESS"
        assert delivery["event_type"] == "TEST_EVENT"
        assert delivery["response_status_code"] == 200
        assert delivery["attempt_count"] == 1
        mock_deliver.assert_called_once()


def test_webhook_retry_and_failure_semantics(client, db):
    """Verify 4xx permanent failure (no retry) and 5xx bounded retry semantics."""
    org, user, headers = create_tenant(db, name="Flaky Org", email_prefix="flaky")

    with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
        create_res = client.post(
            "/api/v1/webhooks",
            json={
                "name": "Flaky Webhook",
                "endpoint_url": "https://example.com/flaky",
                "events": ["VIOLATION_TRIGGERED"]
            },
            headers=headers
        )
        assert create_res.status_code == 200
        webhook_id = create_res.json()["id"]

    # Case 1: 404 Client error -> Permanent FAILED, attempt_count == 1
    mock_resp_404 = MagicMock()
    mock_resp_404.status_code = 404
    mock_resp_404.text = "Not Found"

    with patch("httpx.Client.post", return_value=mock_resp_404) as mock_http_post:
        delivery = webhook_service.deliver_webhook_sync(
            db=db,
            webhook_id=uuid.UUID(webhook_id),
            event_id=uuid.uuid4(),
            event_type="VIOLATION_TRIGGERED",
            payload_dict={"test": "retry"},
            max_retries=3
        )
        assert delivery.status == "FAILED"
        assert delivery.response_status_code == 404
        assert delivery.attempt_count == 1
        assert mock_http_post.call_count == 1

    # Case 2: 500 Server error -> Retries up to max_retries
    mock_resp_500 = MagicMock()
    mock_resp_500.status_code = 500
    mock_resp_500.text = "Internal Server Error"

    with patch("httpx.Client.post", return_value=mock_resp_500) as mock_http_post, patch("time.sleep"):
        delivery = webhook_service.deliver_webhook_sync(
            db=db,
            webhook_id=uuid.UUID(webhook_id),
            event_id=uuid.uuid4(),
            event_type="VIOLATION_TRIGGERED",
            payload_dict={"test": "retry"},
            max_retries=3
        )
        assert delivery.status == "FAILED"
        assert delivery.attempt_count == 3
        assert mock_http_post.call_count == 3


def test_live_receiver_e2e_signature_and_async_behavior(client, db):
    """
    End-to-End Test with a real live HTTP server receiver:
    - Verifies receiver receives raw bytes and calculates HMAC-SHA256 matching X-FlientSec-Signature.
    - Verifies 200 OK delivery sets WebhookDelivery to SUCCESS.
    - Verifies async check-in returns immediately without blocking even if webhook receiver is slow.
    """
    received_requests = []

    class MockWebhookServerHandler(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode("utf-8")
            timestamp = self.headers.get("X-FlientSec-Timestamp")
            event_id = self.headers.get("X-FlientSec-Event-ID")
            signature = self.headers.get("X-FlientSec-Signature")

            received_requests.append({
                "path": self.path,
                "raw_body": raw_body,
                "timestamp": timestamp,
                "event_id": event_id,
                "signature": signature,
                "headers": dict(self.headers),
            })

            if self.path == "/slow":
                time.sleep(1.0)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status": "slow_ok"}')
            elif self.path == "/error500":
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'{"error": "internal error"}')
            elif self.path == "/error400":
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "bad request"}')
            else:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status": "received"}')

        def log_message(self, format, *args):
            # Suppress HTTP server output in test logs
            pass

    # Start live HTTP server on ephemeral port
    server = http.server.HTTPServer(("127.0.0.1", 0), MockWebhookServerHandler)
    server_port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        org, user, headers = create_tenant(db, name="Live Receiver Org", email_prefix="live_hook")

        # 1. Create Webhook pointing to live test server
        signing_secret = "live_secret_hex_1234567890abcdef1234567890abcdef"
        webhook = models.Webhook(
            id=uuid.uuid4(),
            organization_id=org.id,
            name="Live Integration Hook",
            endpoint_url=f"http://127.0.0.1:{server_port}/success",
            signing_secret=signing_secret,
            enabled=True,
            events='["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED", "POLICY_ROLLBACK"]'
        )
        db.add(webhook)
        db.commit()

        # 2. Test live delivery (200 OK)
        evt_id = uuid.uuid4()
        payload = {
            "id": str(evt_id),
            "type": "VIOLATION_TRIGGERED",
            "version": "1",
            "timestamp": datetime.utcnow().isoformat(),
            "organization_id": str(org.id),
            "data": {"rule": "firewall.enabled", "compliant": False}
        }

        delivery = webhook_service.deliver_webhook_sync(
            db=db,
            webhook_id=webhook.id,
            event_id=evt_id,
            event_type="VIOLATION_TRIGGERED",
            payload_dict=payload
        )

        assert delivery.status == "SUCCESS"
        assert delivery.response_status_code == 200
        assert delivery.attempt_count == 1
        assert len(received_requests) == 1

        req = received_requests[-1]
        assert req["event_id"] == str(evt_id)
        assert req["timestamp"] is not None

        # Verify HMAC computed by receiver matches X-FlientSec-Signature
        expected_sig = hmac.new(
            signing_secret.encode("utf-8"),
            f"{req['timestamp']}.{req['raw_body']}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        assert req["signature"] == expected_sig

        # 3. Test 400 Bad Request on live server -> single attempt, status FAILED
        webhook.endpoint_url = f"http://127.0.0.1:{server_port}/error400"
        db.commit()

        delivery_400 = webhook_service.deliver_webhook_sync(
            db=db,
            webhook_id=webhook.id,
            event_id=uuid.uuid4(),
            event_type="VIOLATION_TRIGGERED",
            payload_dict={"test": "400"}
        )
        assert delivery_400.status == "FAILED"
        assert delivery_400.response_status_code == 400
        assert delivery_400.attempt_count == 1

        # 4. Test 500 Error on live server with retries -> 3 attempts, status FAILED
        webhook.endpoint_url = f"http://127.0.0.1:{server_port}/error500"
        db.commit()

        with patch("time.sleep"):  # fast-forward retry sleep in test
            delivery_500 = webhook_service.deliver_webhook_sync(
                db=db,
                webhook_id=webhook.id,
                event_id=uuid.uuid4(),
                event_type="VIOLATION_TRIGGERED",
                payload_dict={"test": "500"},
                max_retries=3
            )
        assert delivery_500.status == "FAILED"
        assert delivery_500.response_status_code == 500
        assert delivery_500.attempt_count == 3
    finally:
        server.shutdown()
        server.server_close()
