import hashlib
import hmac
import ipaddress
import json
import logging
import socket
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Tuple
from urllib.parse import urlparse
import httpx
from sqlalchemy.orm import Session
from app.models import models

logger = logging.getLogger(__name__)

# Global flag that tests can toggle if local test URLs are used
ALLOW_LOCAL_WEBHOOKS = False


def validate_webhook_url(url: str, allow_local: bool = False) -> Tuple[bool, str]:
    """
    Validates webhook URL for safety, preventing SSRF attacks to internal networks,
    localhost, link-local, or cloud metadata services.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, "URL scheme must be http or https"

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL host"

        if not allow_local and not ALLOW_LOCAL_WEBHOOKS:
            try:
                addr_info = socket.getaddrinfo(hostname, None)
            except Exception as e:
                return False, f"Failed to resolve host '{hostname}': {str(e)}"

            for item in addr_info:
                ip_str = item[4][0]
                try:
                    ip = ipaddress.ip_address(ip_str)
                    if (
                        ip.is_loopback
                        or ip.is_private
                        or ip.is_link_local
                        or ip.is_multicast
                        or ip.is_reserved
                        or ip_str == "169.254.169.254"
                        or ip_str.startswith("0.")
                        or ip_str.startswith("127.")
                    ):
                        return False, f"Destination IP '{ip_str}' is restricted (SSRF protection)"
                except ValueError:
                    return False, f"Invalid IP address format: '{ip_str}'"

        return True, ""
    except Exception as e:
        return False, f"URL validation error: {str(e)}"


def compute_signature(secret: str, timestamp: str, raw_body: str) -> str:
    """
    Computes HMAC-SHA256 signature using timestamp + '.' + raw_body.
    """
    payload_to_sign = f"{timestamp}.{raw_body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload_to_sign, hashlib.sha256).hexdigest()


def verify_signature(secret: str, timestamp: str, raw_body: str, signature: str) -> bool:
    """
    Verifies HMAC-SHA256 signature using constant-time comparison.
    """
    expected = compute_signature(secret, timestamp, raw_body)
    return hmac.compare_digest(expected, signature)


def deliver_webhook_sync(
    db: Session,
    webhook_id: uuid.UUID,
    event_id: uuid.UUID,
    event_type: str,
    payload_dict: Dict[str, Any],
    max_retries: int = 3
) -> models.WebhookDelivery:
    """
    Delivers a webhook event synchronously with bounded exponential backoff retries.
    Saves delivery record to the database.
    """
    webhook = db.query(models.Webhook).filter(models.Webhook.id == webhook_id).first()
    if not webhook or not webhook.enabled:
        logger.info(f"Webhook {webhook_id} is disabled or deleted, skipping delivery.")
        return None

    # Check event subscription
    try:
        subscribed = json.loads(webhook.events) if isinstance(webhook.events, str) else webhook.events
    except Exception:
        subscribed = ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]

    if event_type not in subscribed:
        logger.info(f"Webhook {webhook_id} is not subscribed to {event_type}, skipping.")
        return None

    # Create WebhookDelivery record
    delivery = models.WebhookDelivery(
        id=uuid.uuid4(),
        webhook_id=webhook.id,
        event_id=event_id,
        event_type=event_type,
        status="PENDING",
        attempt_count=0,
        created_at=datetime.utcnow(),
    )
    db.add(delivery)
    db.commit()

    raw_body = json.dumps(payload_dict, separators=(",", ":"), default=str)
    timestamp = str(int(time.time()))
    signature = compute_signature(webhook.signing_secret, timestamp, raw_body)

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "FlientSec-Webhook/1.0",
        "X-FlientSec-Timestamp": timestamp,
        "X-FlientSec-Event-ID": str(event_id),
        "X-FlientSec-Signature": signature,
    }

    # Bounded retries
    success = False
    last_error = None
    last_status_code = None

    for attempt in range(1, max_retries + 1):
        delivery.attempt_count = attempt
        try:
            with httpx.Client(timeout=5.0, follow_redirects=False) as client:
                response = client.post(webhook.endpoint_url, content=raw_body.encode("utf-8"), headers=headers)
                last_status_code = response.status_code

                if 200 <= response.status_code < 300:
                    success = True
                    delivery.status = "SUCCESS"
                    delivery.response_status_code = response.status_code
                    delivery.delivered_at = datetime.utcnow()
                    delivery.error_message = None
                    break
                elif 400 <= response.status_code < 500:
                    # Permanent client failure -> do not retry
                    delivery.status = "FAILED"
                    delivery.response_status_code = response.status_code
                    delivery.error_message = f"HTTP {response.status_code}: {response.text[:200]}"
                    break
                else:
                    # 5xx Server Error -> eligible for retry
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    delivery.response_status_code = response.status_code
                    delivery.error_message = last_error
        except Exception as e:
            last_error = f"Connection error: {str(e)}"
            delivery.error_message = last_error

        # Backoff before next attempt if retrying
        if attempt < max_retries and not success and (last_status_code is None or last_status_code >= 500):
            delivery.status = "RETRYING"
            db.commit()
            time.sleep(0.5 * (2 ** (attempt - 1)))

    if not success and delivery.status != "FAILED":
        delivery.status = "FAILED"

    db.commit()
    db.refresh(delivery)
    return delivery
