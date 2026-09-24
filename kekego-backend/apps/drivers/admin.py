from django.contrib import admin

from apps.drivers.models import DriverProfile


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    """Admin management of driver profiles incl. verification."""

    list_display = ("user", "is_verified", "availability_status", "vehicle_type", "updated_at")
    list_filter = ("is_verified", "availability_status", "vehicle_type")
    search_fields = ("user__email", "user__first_name", "user__last_name", "vehicle_plate", "license_number")
    readonly_fields = ("created_at", "updated_at")
    actions = ["verify_selected"]

    @admin.action(description="Verify selected driver accounts")
    def verify_selected(self, request, queryset):
        updated = queryset.update(is_verified=True)
        self.message_user(request, f"Verified {updated} driver account(s).")