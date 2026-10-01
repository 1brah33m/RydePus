from django.contrib import admin

from apps.trips.models import Rating, Trip


class RatingInline(admin.TabularInline):
    model = Rating
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    """Admin management for trips."""

    list_display = ("id", "pickup_location", "destination", "status", "fare", "created_by", "driver", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("pickup_location", "destination", "created_by__email", "driver__email")
    readonly_fields = ("created_at", "updated_at", "started_at", "completed_at")
    inlines = [RatingInline]


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    """Admin management for trip ratings."""

    list_display = ("id", "trip", "user", "stars", "created_at")
    list_filter = ("stars", "created_at")
    search_fields = ("user__email", "trip__pickup_location", "trip__destination")
    readonly_fields = ("created_at", "updated_at")
