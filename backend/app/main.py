from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import admin, analytics, auth, dashboard, feedback, finalized_weeks, reports, stats, submissions, taxonomy, verification, work_events

settings = get_settings()

app = FastAPI(
    title="Open Working Hours API",
    version="0.1.0",
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/healthz", tags=["meta"])
def healthcheck() -> dict[str, str]:
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
