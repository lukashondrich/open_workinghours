from __future__ import annotations

from functools import lru_cache

from .config import get_settings


@lru_cache
def allowed_domains() -> set[str] | None:
    settings = get_settings()
    if settings.allowed_email_domains_file is None:
        return None
    path = settings.allowed_email_domains_file.expanduser()
    try:
        with path.open("r", encoding="utf-8") as handle:
            return {
                line.strip().lower()
                for line in handle
                if line.strip() and not line.startswith("#")
            }
    except FileNotFoundError:
        return None
