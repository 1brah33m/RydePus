from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0002_payment_group_payment_kind_payment_seats_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="idempotency_key",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.UniqueConstraint(
                condition=~models.Q(idempotency_key=""),
                fields=("payer", "idempotency_key"),
                name="payment_unique_payer_idempotency_key",
            ),
        ),
    ]