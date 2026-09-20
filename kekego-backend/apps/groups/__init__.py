"""Group ride domain app.

Placeholder for the core ride-grouping feature. Future models:

- ``Group`` (pickup, destination, capacity, status)
- ``GroupMember`` (membership + seat count)

Key rule preserved for later: a group becomes eligible for driver matching
only at FULL capacity (4/4), or immediately when one student pays for all 4
seats. Joining must be concurrency-safe (``select_for_update`` +
transactions) so two simultaneous joins can never exceed 4/4.
"""