import time
from collections import defaultdict, deque
from collections.abc import Callable

DAY_SECONDS = 24 * 60 * 60
MINUTE_SECONDS = 60


class RateLimiter:
    """Sliding-window limiter held in memory, so limits apply per server process."""

    def __init__(
        self,
        per_minute: int,
        per_day: int,
        action: str = "scans",
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.action = action
        self.per_minute = per_minute
        self.per_day = per_day
        self.clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, user_id: str) -> str | None:
        """Record a hit and return None, or return a user-facing message when over a limit."""
        now = self.clock()
        hits = self._hits[user_id]
        while hits and now - hits[0] >= DAY_SECONDS:
            hits.popleft()

        if len(hits) >= self.per_day:
            return f"You have used all your {self.action} for today. Please come back tomorrow."
        if sum(now - hit < MINUTE_SECONDS for hit in hits) >= self.per_minute:
            return f"Too many {self.action} right now, try again in a minute."

        hits.append(now)
        return None


scan_limiter = RateLimiter(per_minute=5, per_day=20)
# Searches run while typing, so they get more room than scans.
search_limiter = RateLimiter(per_minute=20, per_day=200, action="searches")
