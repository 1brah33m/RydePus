from django.urls import path

from apps.trips.views import AvailableTripListView, StudentTripCancelView, TripAcceptView, TripListCreateView, TripStatusUpdateView

urlpatterns = [
    path("", TripListCreateView.as_view(), name="trips-list-create"),
    path("available/", AvailableTripListView.as_view(), name="trips-available"),
    path("<int:trip_id>/accept/", TripAcceptView.as_view(), name="trips-accept"),
    path("<int:trip_id>/cancel/", StudentTripCancelView.as_view(), name="trips-student-cancel"),
    path("<int:trip_id>/<str:action>/", TripStatusUpdateView.as_view(), name="trips-status-update"),
]
