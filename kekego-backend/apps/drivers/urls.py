from django.urls import path

from apps.drivers.views import DriverAvailabilityView, DriverMeView, DriverPayoutView

urlpatterns = [
    path("me/", DriverMeView.as_view(), name="driver-me"),
    path("availability/", DriverAvailabilityView.as_view(), name="driver-availability"),
    path("payout/", DriverPayoutView.as_view(), name="driver-payout"),
]
