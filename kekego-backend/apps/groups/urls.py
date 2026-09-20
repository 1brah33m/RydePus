from django.urls import path

from apps.groups.views import GroupBuyoutView, GroupCancelView, GroupJoinView, GroupLeaveView, GroupListView, StudentOnlyPingView

urlpatterns = [
    path("", GroupListView.as_view(), name="groups-list"),
    path("<int:group_id>/join/", GroupJoinView.as_view(), name="groups-join"),
    path("<int:group_id>/leave/", GroupLeaveView.as_view(), name="groups-leave"),
    path("<int:group_id>/cancel/", GroupCancelView.as_view(), name="groups-cancel"),
    path("<int:group_id>/buyout/", GroupBuyoutView.as_view(), name="groups-buyout"),
    path("ping/", StudentOnlyPingView.as_view(), name="groups-ping"),
]