from django.urls import path

from apps.groups.views import StudentOnlyPingView

urlpatterns = [
    path("ping/", StudentOnlyPingView.as_view(), name="groups-ping"),
]