from django.urls import path

from apps.notifications.views import NotificationListView, NotificationMarkReadView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("<int:notification_id>/read/", NotificationMarkReadView.as_view(), name="notifications-mark-read"),
]
