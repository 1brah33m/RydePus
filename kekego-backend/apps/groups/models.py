from django.conf import settings
from django.db import models


class Group(models.Model):
    """A student-led ride group for a route or destination."""

    name = models.CharField(max_length=150)
    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    capacity = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            GroupMember.objects.get_or_create(group=self, user=self.created_by)

    @property
    def member_count(self):
        return self.members.count()

    def __str__(self) -> str:
        return self.name


class GroupMember(models.Model):
    """Membership record for a student in a group."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="group_memberships")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")
        ordering = ("joined_at",)

    def __str__(self) -> str:
        return f"{self.user.email} -> {self.group.name}"