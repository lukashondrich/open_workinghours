"""
Rate limiting for FastAPI endpoints.

Uses in-memory token bucket per client IP. Suitable for single-server deployment.
Uses X-Real-IP header from nginx reverse proxy for client identification.

IMPORTANT: The backend container port must NOT be publicly reachable.
Only nginx on the same host should be able to reach port 8000.
This is enforced by binding to 127.0.0.1 in docker-compose.yml.

NOTE: Uses Depends()-based rate limiting instead of @limiter.limit() decorators
because `from __future__ import annotations` in routers makes slowapi decorators
break FastAPI's body parameter resolution (ForwardRef not resolved in wrapper scope).
"""
import time
from collections import defaultdict
from threading import Lock

from fastapi import Depends, HTTPException, Request


def _get_client_ip(request: Request) -> str:
    """Extract client IP from X-Real-IP (set by nginx) or fall back to remote address."""
    forwarded_ip = request.headers.get("X-Real-IP")
    if forwarded_ip:
        return forwarded_ip
    return request.client.host if request.client else "unknown"


class _RateLimitStore:
    """Thread-safe in-memory rate limit tracker."""

    def __init__(self) -> None:
        # Key: (client_ip, endpoint_key) → list of timestamps
        self._hits: dict[tuple[str, str], list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, client_ip: str, endpoint_key: str, max_hits: int, window_seconds: int) -> bool:
        """Return True if request is allowed, False if rate limit exceeded."""
        now = time.monotonic()
        key = (client_ip, endpoint_key)

        with self._lock:
            # Prune expired entries
            self._hits[key] = [t for t in self._hits[key] if now - t < window_seconds]

            if len(self._hits[key]) >= max_hits:
                return False

            self._hits[key].append(now)
            return True

    def reset(self) -> None:
        """Clear all rate limit state (useful for testing)."""
        with self._lock:
            self._hits.clear()


# Global store instance
store = _RateLimitStore()


def rate_limit(max_hits: int, window_seconds: int):
    """
    Create a FastAPI dependency that enforces a rate limit.

    Args:
        max_hits: Maximum number of requests allowed in the window.
        window_seconds: Time window in seconds.

    Usage:
        @router.post("/login")
        def login(request: Request, _rl=Depends(rate_limit(5, 60))):
            ...
    """
    def dependency(request: Request) -> None:
        client_ip = _get_client_ip(request)
        endpoint_key = f"{request.method}:{request.url.path}"

        if not store.check(client_ip, endpoint_key, max_hits, window_seconds):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
            )

    return dependency
