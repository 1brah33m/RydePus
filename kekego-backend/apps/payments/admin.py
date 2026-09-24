from django.contrib import admin

from apps.payments.models import Payment, Refund


class RefundInline(admin.TabularInline):
    model = Refund
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Admin management for payments and refunds."""

    list_display = ("id", "payer", "kind", "status", "amount", "currency", "provider_reference", "created_at")
    list_filter = ("kind", "status", "currency", "created_at")
    search_fields = ("payer__email", "provider_reference", "settlement_reference", "idempotency_key")
    readonly_fields = ("created_at", "updated_at", "reconciled_at", "refunded_at")
    inlines = [RefundInline]


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    """Admin management for individual refunds."""

    list_display = ("id", "payment", "amount", "status", "provider_reference", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("payment__provider_reference", "provider_reference", "payment__payer__email")
    readonly_fields = ("created_at", "updated_at")
