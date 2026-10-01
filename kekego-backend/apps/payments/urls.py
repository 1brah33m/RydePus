from django.urls import path

from apps.payments.views import (
    DriverCollectablePaymentListView,
    PaymentConfirmView,
    PaymentListCreateView,
    PaymentRejectView,
)

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payments-list-create"),
    path("collectable/", DriverCollectablePaymentListView.as_view(), name="payments-collectable"),
    path("<int:payment_id>/confirm/", PaymentConfirmView.as_view(), name="payments-confirm"),
    path("<int:payment_id>/reject/", PaymentRejectView.as_view(), name="payments-reject"),
]
