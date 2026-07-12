import asyncio
from contextlib import suppress
import logging

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .cleanup import purge_old_feedback_reports_once
from .config import get_settings
from .database import SessionLocal, init_db
from .rate_limit import rate_limit
from .routers import admin, analytics, auth, dashboard, feedback, finalized_weeks, reports, stats, submissions, taxonomy, verification, work_events

settings = get_settings()
logger = logging.getLogger(__name__)
FEEDBACK_REPORT_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60
_feedback_report_cleanup_task: asyncio.Task[None] | None = None


def _run_feedback_report_cleanup() -> None:
    try:
        deleted_count = purge_old_feedback_reports_once()
        if deleted_count:
            logger.info("Purged %s old feedback reports", deleted_count)
    except Exception:
        logger.exception("Failed to purge old feedback reports")


async def _feedback_report_cleanup_loop() -> None:
    while True:
        await asyncio.sleep(FEEDBACK_REPORT_CLEANUP_INTERVAL_SECONDS)
        _run_feedback_report_cleanup()

app = FastAPI(
    title="Open Working Hours API",
    version="0.1.0",
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)


def _ensure_demo_user_flagged() -> None:
    """Idempotently flag the configured demo account is_demo=true.

    The demo login bypass requires the flag; running this at startup removes
    the deploy-time dependency on manually re-running seed_demo_user.py.
    """
    if settings.demo is None:
        return
    from .models import User
    from .security import hash_email

    try:
        with SessionLocal() as db:
            user = (
                db.query(User)
                .filter(User.email_hash == hash_email(settings.demo.email.lower()))
                .one_or_none()
            )
            if user is not None and not user.is_demo:
                user.is_demo = True
                db.commit()
                logger.info("Flagged existing demo user is_demo=true")
    except Exception:
        logger.exception("Failed to ensure demo user flag")


@app.on_event("startup")
async def on_startup() -> None:
    global _feedback_report_cleanup_task
    init_db()
    _ensure_demo_user_flagged()
    _run_feedback_report_cleanup()
    _feedback_report_cleanup_task = asyncio.create_task(_feedback_report_cleanup_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    global _feedback_report_cleanup_task
    if _feedback_report_cleanup_task is None:
        return

    _feedback_report_cleanup_task.cancel()
    with suppress(asyncio.CancelledError):
        await _feedback_report_cleanup_task
    _feedback_report_cleanup_task = None


@app.get("/healthz", tags=["meta"])
def healthcheck(response: Response, _rl: None = Depends(rate_limit(30, 60))) -> dict[str, str]:
    """Liveness + DB connectivity: a dead database must not report healthy."""
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Health check failed: database unreachable")
        response.status_code = 503
        return {"status": "degraded", "database": "unreachable"}
    return {"status": "ok"}


app.include_router(admin.router)
app.include_router(verification.router)
app.include_router(auth.router)
app.include_router(work_events.router)
app.include_router(finalized_weeks.router)
app.include_router(stats.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(submissions.router)
app.include_router(feedback.router)
app.include_router(taxonomy.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response
