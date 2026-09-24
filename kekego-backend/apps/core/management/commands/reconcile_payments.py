"""``reconcile_payments`` - reconcile provider state against local payments.

For every payment whose provider supports a ``verify_transaction`` call (e.g.
Paystack), fetch the authoritative provider status and align local state:

- ``PENDING`` payments that the provider confirms are marked ``SUCCESSFUL``;
- provider-reported failures mark the payment ``FAILED``;
- settlement references and ``reconciled_at`` are captured, and mismatches are
  surfaced through logs + the alert notifier.

Run periodically (Celery beat ``payments.reconcile`` or cron).
"""

import logging

from django.core.management.base import BaseCommand

from apps.payments.models import Payment
from apps.payments.providers import PaymentProviderError, get_provider

logger = logging.getLogger("campus_keke.tasks")


class Command(BaseCommand):
    help = "Reconcile local payment state with the payment provider."

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            dest="provider_name",
            default=None,
            help="Provider to reconcile against (default: configured PAYMENT_PROVIDER).",
        )

    def handle(self, *args, **options):
        provider = get_provider()
        verify = getattr(provider, "verify_transaction", None)
        if verify is None:
            self.stdout.write(
                self.style.WARNING(f"Provider {provider.name!r} has no verify_transaction; nothing to reconcile.")
            )
            return

        payments = Payment.objects.filter(
            status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
        ).exclude(provider_reference="")
        reconciled = failed = errors = 0
        for payment in payments:
            try:
                result = verify(payment.provider_reference)
            except (PaymentProviderError, ValueError) as exc:
                errors += 1
                logger.warning("reconcile_error payment_id=%s error=%s", payment.pk, exc)
                continue
            reconciled += self._apply_result(payment, result)

        self.stdout.write(
            self.style.SUCCESS(f"Reconciliation complete: {reconciled} reconciled, {failed} failed, {errors} errors.")
        )

    def _apply_result(self, payment, result: dict) -> int:
        from django.db import transaction

        with transaction.atomic():
            refreshed = Payment.objects.select_for_update().get(pk=payment.pk)
        provider_status = str(result.get("status", "")).upper()
        if provider_status == "SUCCESS" and refreshed.status != Payment.Status.SUCCESSFUL:
            refreshed.status = Payment.Status.SUCCESSFUL
            refreshed.provider_event = result.get("event", "")
            refreshed.save(update_fields=["status", "provider_event", "updated_at"])
        elif provider_status in ("FAILED", "ABANDONED"):
            if refreshed.status != Payment.Status.FAILED:
                refreshed.status = Payment.Status.FAILED
                refreshed.provider_event = result.get("event", "")
                refreshed.save(update_fields=["status", "provider_event", "updated_at"])
        settlement = result.get("settlement_reference", "")
        if settlement:
            refreshed.settlement_reference = settlement
            refreshed.reconciled_at = _now()
            refreshed.save(update_fields=["settlement_reference", "reconciled_at", "updated_at"])
        logger.info(
            "reconciliation payment_id=%s provider=%s status=%s",
            refreshed.pk,
            result.get("provider", ""),
            provider_status,
        )
        return 1


def _now():
    from django.utils import timezone

    return timezone.now()
