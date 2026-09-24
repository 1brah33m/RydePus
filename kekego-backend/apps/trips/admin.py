from django.contrib import admin

from apps.trips.models import Trip, TripRating


class TripRatingInline(admin.TabularInline):
    model = TripRating
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    """Admin management for trips."""

    list_display = ("id", "pickup_location", "destination", "status", "fare", "created_by", "driver", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("pickup_location", "destination", "created_by__email", "driver__email")
    readonly_fields = ("created_at", "updated_at")
    inlines = [TripRatingInline]


@admin.register(TripRating)
class TripRatingAdmin(admin.ModelAdmin):
    """Admin management for trip ratings."""

    list_display = ("id", "trip", "rater", "score", "created_at")
