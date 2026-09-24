"""``collect_metrics`` - print and reset the in-process monitoring counters.

Useful for cron-driven metric collection and for verifying the metrics
pipeline end to end without a datastore.
"""

import json

from django.core.management.base import BaseCommand

from config.monitoring import emissions


class Command(BaseCommand):
    help = "Print and reset in-process monitoring counters."

    def handle(self, *args, **options):
        self.stdout.write(json.dumps(emissions.collect(), default=str))
