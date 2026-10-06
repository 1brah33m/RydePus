from django.urls import path

from apps.payments.views import (
    DriverCollectablePaymentListView,
    PaymentListCreateView,
)

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payments-list-create"),
    path("collectable/", DriverCollectablePaymentListView.as_view(), name="payments-collectable"),
]
