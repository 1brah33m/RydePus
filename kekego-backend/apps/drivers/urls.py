from django.urls import path

from apps.drivers.views import DriverAvailabilityView, DriverMeView

urlpatterns = [
    path("me/", DriverMeView.as_view(), name="driver-me"),
    path("availability/", DriverAvailabilityView.as_view(), name="driver-availability"),
]
