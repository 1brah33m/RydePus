from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("trips", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TripRating",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.PositiveSmallIntegerField()),
                ("comment", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("rater", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trip_ratings", to=settings.AUTH_USER_MODEL)),
                ("trip", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ratings", to="trips.trip")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(
            model_name="triprating",
            constraint=models.UniqueConstraint(fields=("trip", "rater"), name="unique_trip_rating_per_rater"),
        ),
        migrations.AddConstraint(
            model_name="triprating",
            constraint=models.CheckConstraint(condition=models.Q(score__gte=1, score__lte=5), name="trip_rating_score_1_to_5"),
        ),
    ]