from django.urls import path

from apps.payments.views import PaymentListCreateView, PaymentWebhookView

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payments-list-create"),
    path("webhook/", PaymentWebhookView.as_view(), name="payments-webhook"),
]
