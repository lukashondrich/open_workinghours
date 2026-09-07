"""
Campaign tap counter — first-party, no tracking.

`GET /go/{slug}` writes one log line and 302-redirects to the campaign's
destination (e.g. an App Store campaign link). The log line carries only the
slug and the request timestamp: no cookie, no user id, no IP is stored by
this handler. Purpose: count how many landing-page visitors tap through to
the store, so the ad funnel has a middle number (Meta counts ad taps, Apple
counts store views; nothing counted the hop in between).

Why a hop at all: Meta refuses ad destinations that resolve into the App
Store, so ads land on a plain page; the badge on that page points here.

Count:  docker compose logs backend | grep -c "go_click slug=ig2"
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from ..rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/go", tags=["meta"])

# slug -> destination. Add a row per campaign; never reuse a slug for a new
# campaign (the count would blend).
CAMPAIGN_LINKS: dict[str, str] = {
    "ig2": (
        "https://apps.apple.com/app/apple-store/id6755491395"
        "?pt=128304319&ct=ig-test-2026-09-collective&mt=8"
    ),
}


@router.get("/{slug}", include_in_schema=False)
def go(slug: str, _rl: None = Depends(rate_limit(120, 60))) -> RedirectResponse:
    target = CAMPAIGN_LINKS.get(slug)
    if target is None:
        raise HTTPException(status_code=404, detail="Unknown campaign")
    logger.info("go_click slug=%s", slug)
    return RedirectResponse(url=target, status_code=302)
