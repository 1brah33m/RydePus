from django.urls import path

from apps.drivers.views import DriverMeView

urlpatterns = [
    path("me/", DriverMeView.as_view(), name="driver-me"),
]