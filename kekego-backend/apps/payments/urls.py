from django.urls import path

from apps.payments.views import PaymentListCreateView, PaymentRefundView, PaymentWebhookView

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payments-list-create"),
    path("webhook/", PaymentWebhookView.as_view(), name="payments-webhook"),
    path("<int:payment_id>/refund/", PaymentRefundView.as_view(), name="payments-refund"),
]
