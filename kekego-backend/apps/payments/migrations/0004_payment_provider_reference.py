from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0003_payment_idempotency_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="provider_reference",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]