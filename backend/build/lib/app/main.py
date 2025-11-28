from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import analytics, reports, submissions, verification

app = FastAPI(
    title="Open Working Hours API",
    version="0.1.0",
    docs_url="/docs",
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/healthz", tags=["meta"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(verification.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(submissions.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
