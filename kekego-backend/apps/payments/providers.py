"""Payment provider adapters.

The backend never trusts client-supplied amounts or completion claims.
Payments are initialized server-side through a provider and only move to
``SUCCESSFUL`` after the provider confirms them via a verified webhook.

``manual`` is a dev/test placeholder with no fraud-resistance guarantees;
production defaults to ``paystack`` and refuses to boot without credentials.
"""

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
import uuid

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger("campus_keke.audit")


class PaymentProviderError(Exception):
    """Raised when a payment provider rejects or cannot serve a request."""


def _compute_reference(payment) -> str:
    return f"{settings.PAYMENT_PROVIDER}_{payment.pk}_{uuid.uuid4().hex[:8]}"


class ManualProvider:
    """Records intents locally without an external authorization step.

    Only for development and tests. Never select this in production.
    """

    name = "manual"

    def initialize(self, payment) -> dict:
        reference = payment.provider_reference or _compute_reference(payment)
        payment.provider_reference = reference
        payment.save(update_fields=["provider_reference", "updated_at"])
        return {"reference": reference, "authorization_url": None}

    def verify_webhook(self, raw_body: bytes, headers: dict) -> bool:
        try:
            payload = json.loads(raw_body)
        except ValueError:
            return False
        return bool(payload.get("data", {}).get("reference"))


class PaystackProvider:
    """Paystack (NGN) integration using its initialize + webhook APIs."""

    name = "paystack"
    base_url = "https://api.paystack.co"

    def __init__(self, secret_key: str, webhook_secret: str):
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret

    def initialize(self, payment) -> dict:
        request = urllib.request.Request(
            f"{self.base_url}/transaction/initialize",
            data=json.dumps(
                {
                    "email": payment.payer.email,
                    "amount": int(payment.amount * 100),  # kobo
                    "reference": payment.provider_reference or _compute_reference(payment),
                    "currency": payment.currency,
                    "metadata": {
                        "payment_id": payment.pk,
                        "kind": payment.kind,
                        "seats": payment.seats,
                        "source": "rydepus-backend",
                    },
                }
            ).encode(),
            headers={
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise PaymentProviderError(f"Provider rejected initialization ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise PaymentProviderError(f"Provider unreachable: {exc.reason}") from exc

        if not body.get("status"):
            message = body.get("message", "Unknown provider error")
            raise PaymentProviderError(f"Provider initialization failed: {message}")

        data = body.get("data", {})
        reference = data.get("reference") or _compute_reference(payment)
        payment.provider_reference = reference
        payment.save(update_fields=["provider_reference", "updated_at"])
        return {"reference": reference, "authorization_url": data.get("authorization_url")}

    def verify_webhook(self, raw_body: bytes, headers: dict) -> bool:
        signature = str(headers.get("X-Paystack-Signature", ""))
        expected = hmac.new(self.webhook_secret.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(signature, expected)


def get_provider():
    """Return the configured provider instance."""
    name = (settings.PAYMENT_PROVIDER or "manual").strip().lower()
    if name == "paystack":
        if not settings.PAYSTACK_SECRET_KEY:
            raise ImproperlyConfigured("PAYSTACK_SECRET_KEY must be set when PAYMENT_PROVIDER=paystack.")
        if not settings.PAYSTACK_WEBHOOK_SECRET:
            raise ImproperlyConfigured("PAYSTACK_WEBHOOK_SECRET must be set when PAYMENT_PROVIDER=paystack.")
        return PaystackProvider(settings.PAYSTACK_SECRET_KEY, settings.PAYSTACK_WEBHOOK_SECRET)
    if name == "manual":
        return ManualProvider()
    raise ImproperlyConfigured(f"Unsupported PAYMENT_PROVIDER: {name!r}")


def initialize_payment(payment):
    """Ask the active provider for an authorization and store its reference.

    Succeeds for pending intents; raises ``PaymentProviderError`` when the
    provider rejects the request.
    """
    provider = get_provider()
    result = provider.initialize(payment)
    logger.info(
        "payment_initialized payment_id=%s provider=%s reference=%s",
        payment.pk,
        provider.name,
        result.get("reference"),
    )
    return result


def webhook_reference(raw_body: bytes) -> str:
    """Extract the provider reference from a (already verified) webhook body."""
    payload = json.loads(raw_body)
    return str(payload.get("data", {}).get("reference", "")).strip()