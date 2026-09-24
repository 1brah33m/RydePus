from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin management for user notifications."""

    list_display = ("id", "user", "notification_type", "is_read", "is_sent", "created_at")
    list_filter = ("notification_type", "is_read", "is_sent", "created_at")
    search_fields = ("user__email", "title", "message")
    readonly_fields = ("created_at", "updated_at")
