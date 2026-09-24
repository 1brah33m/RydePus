from django.db import migrations, models


def backfill_seats(apps, schema_editor):
    """Assign seat numbers to existing memberships.

    Members already present when this migration ships receive sequential
    seats within the group's current membership, so the new unique
    ``(group, seat)`` constraint never collides with legacy rows.
    """
    Group = apps.get_model("groups", "Group")
    GroupMember = apps.get_model("groups", "GroupMember")

    for group in Group.objects.all().iterator():
        for seat, membership in enumerate(
            GroupMember.objects.filter(group=group).order_by("joined_at"),
            start=1,
        ):
            if membership.seat is None:
                membership.seat = seat
                membership.save(update_fields=["seat"])


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="groupmember",
            name="seat",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_seats, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="groupmember",
            constraint=models.UniqueConstraint(
                condition=~models.Q(("seat__isnull", True)),
                fields=("group", "seat"),
                name="group_member_unique_seat",
            ),
        ),
    ]