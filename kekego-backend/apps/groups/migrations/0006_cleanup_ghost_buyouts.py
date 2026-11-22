"""One-off repair: delete ghost GROUP_BUYOUT seat commitments.

Before leaving freed a member's buyout commitments, a member who left a group
kept their GROUP_BUYOUT rows counting as filled seats: seats nobody owns and
nobody can free, since only members can buy out or leave.

This removes those rows — GROUP_BUYOUT payments (PENDING/SUCCESSFUL) whose
payer is no longer a member of the group — and recalculates each affected
group's FULL/WAITING status. It only touches buyouts with no matching
membership, so it is safe to run on any database, including ones with no
ghost rows (a no-op there).
"""

from django.db import migrations, models


def cleanup_ghost_buyouts(apps, schema_editor):
    Payment = apps.get_model("payments", "Payment")
    Group = apps.get_model("groups", "Group")
    GroupMember = apps.get_model("groups", "GroupMember")

    ghost_ids = []
    affected_group_ids = set()
    for payment in (
        Payment.objects.filter(
            kind="GROUP_BUYOUT",
            status__in=["PENDING", "SUCCESSFUL"],
            group__isnull=False,
        )
        .values("id", "group_id", "payer_id")
        .order_by("id")
        .iterator()
    ):
        still_member = GroupMember.objects.filter(
            group_id=payment["group_id"], user_id=payment["payer_id"]
        ).exists()
        if not still_member:
            ghost_ids.append(payment["id"])
            affected_group_ids.add(payment["group_id"])

    if not ghost_ids:
        return

    Payment.objects.filter(id__in=ghost_ids).delete()

    for group in Group.objects.filter(id__in=affected_group_ids):
        member_count = GroupMember.objects.filter(group=group).count()
        bought = (
            Payment.objects.filter(
                group=group,
                kind="GROUP_BUYOUT",
                status__in=["PENDING", "SUCCESSFUL"],
            ).aggregate(total=models.Sum("seats"))["total"]
            or 0
        )
        # Literal choices: historical models in migrations do not carry the
        # Group.Status inner class.
        group.status = "FULL" if member_count + bought >= group.capacity else "WAITING"
        group.save(update_fields=["status", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0005_remap_campus_location_names"),
        ("payments", "0007_alter_payment_status"),
    ]

    operations = [
        migrations.RunPython(cleanup_ghost_buyouts, reverse_code=migrations.RunPython.noop),
    ]
