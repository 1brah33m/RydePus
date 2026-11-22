from django.core.management.base import BaseCommand

from apps.groups.models import GroupMember
from apps.payments.models import Payment


class Command(BaseCommand):
    """Delete ghost buyout seats left behind by former members.

    Before leaving freed a member's buyout commitments, a member who left a
    group kept their GROUP_BUYOUT rows counting as filled seats: seats nobody
    owns and nobody can free (only members can buy out or leave). This command
    removes those rows — GROUP_BUYOUT payments (PENDING/SUCCESSFUL) whose payer
    is no longer a member of the group — and recalculates each affected group's
    FULL/WAITING status.

    Safe to re-run: it only touches buyouts with no matching membership.
    """

    help = "Remove GROUP_BUYOUT seat commitments whose payer is no longer a group member."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be deleted without deleting anything.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        # A ghost buyout is a GROUP_BUYOUT row whose payer is no longer a
        # member of the group. Evaluated in Python to keep the query
        # backend-agnostic.
        ghost_ids: list[int] = []
        affected_group_ids: set[int] = set()
        for payment in (
            Payment.objects.filter(
                kind=Payment.Kind.GROUP_BUYOUT,
                status__in=[Payment.Status.PENDING, Payment.Status.SUCCESSFUL],
                group__isnull=False,
            )
            .select_related("group", "payer")
            .order_by("id")
        ):
            if payment.group_id is None:
                continue
            still_member = GroupMember.objects.filter(
                group_id=payment.group_id, user_id=payment.payer_id
            ).exists()
            if not still_member:
                ghost_ids.append(payment.id)
                affected_group_ids.add(payment.group_id)

        if dry_run:
            self.stdout.write(
                f"Would delete {len(ghost_ids)} ghost buyout payment(s) "
                f"across {len(affected_group_ids)} group(s)."
            )
            return

        from apps.groups.models import Group

        deleted, _ = Payment.objects.filter(id__in=ghost_ids).delete()
        refreshed = 0
        for group in Group.objects.filter(id__in=affected_group_ids):
            group.refresh_status()
            refreshed += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} ghost buyout payment(s); "
                f"refreshed {refreshed} group(s)."
            )
        )
