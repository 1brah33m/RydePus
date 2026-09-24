from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("drivers", "0002_driverprofile_preferred_destination_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="driverprofile",
            name="is_verified",
            field=models.BooleanField(default=False),
        ),
    ]