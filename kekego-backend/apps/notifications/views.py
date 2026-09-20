from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.users.permissions import IsStudent


class NotificationSerializer(serializers.ModelSerializer):
    """Serialize a notification for the authenticated user."""

    class Meta:
        model = Notification
        fields = (
            "id",
            "user",
            "title",
            "message",
            "notification_type",
            "is_read",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class NotificationListView(APIView):
    """GET /api/v1/notifications/ - list current user notifications."""

    permission_classes = [IsStudent]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationMarkReadView(APIView):
    """PATCH /api/v1/notifications/{id}/read/ - mark a notification as read."""

    permission_classes = [IsStudent]

    def patch(self, request, notification_id):
        try:
            notification = Notification.objects.get(pk=notification_id, user=request.user)
        except Notification.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Notification not found."}}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(NotificationSerializer(notification).data)
