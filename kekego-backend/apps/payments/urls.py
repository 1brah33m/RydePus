from django.urls import path

from apps.payments.views import PaymentListCreateView

urlpatterns = [
    path("", PaymentListCreateView.as_view(), name="payments-list-create"),
]
