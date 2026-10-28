"""MeetMind FastAPI Application Entrypoint."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.health import router as health_router
from app.api.organizations import router as org_router
from app.api.meetings import router as meeting_router
from app.api.chat import router as chat_router
from app.api.ingestion import router as ingestion_router
from app.api.knowledge import router as knowledge_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle handler."""
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise AI Meeting Intelligence and Organizational Memory Platform",
    version="0.1.0",
    debug=settings.DEBUG,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(health_router, prefix="/api")
app.include_router(org_router, prefix="/api")
app.include_router(ingestion_router, prefix="/api")
app.include_router(meeting_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(knowledge_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "0.1.0",
        "status": "online",
        "docs_url": "/docs"
    }
