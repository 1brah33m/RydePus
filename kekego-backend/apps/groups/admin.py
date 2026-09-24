from django.contrib import admin

from apps.groups.models import Group, GroupMember


class GroupMemberInline(admin.TabularInline):
    model = GroupMember
    extra = 0
    readonly_fields = ("joined_at",)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    """Admin management for ride groups."""

    list_display = ("id", "name", "pickup_location", "destination", "capacity", "member_count", "created_at")
    list_filter = ("capacity", "created_at")
    search_fields = ("name", "pickup_location", "destination", "created_by__email")
    inlines = [GroupMemberInline]
    readonly_fields = ("created_at", "updated_at")
