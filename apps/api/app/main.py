import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apps.api.app.api.v1.auth import router as auth_router
from apps.api.app.api.v1.documents import router as documents_router
from apps.api.app.api.v1.graph import router as graph_router
from apps.api.app.api.v1.health import router as health_router
from apps.api.app.api.v1.jobs import router as jobs_router
from apps.api.app.api.v1.rag import router as rag_router
from apps.api.app.api.v1.search import router as search_router
from apps.api.app.api.v1.workspaces import router as workspaces_router
from apps.api.app.core.config import settings

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("nexusdocs")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("NexusDocs API starting up...")
    yield
    logger.info("NexusDocs API shutting down...")


app = FastAPI(
    title="NexusDocs API",
    description="Production-grade API for Semantic Markdown Knowledge Graph platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register v1 routes
v1_prefix = "/api/v1"
app.include_router(auth_router, prefix=v1_prefix)
app.include_router(workspaces_router, prefix=v1_prefix)
app.include_router(documents_router, prefix=v1_prefix)
app.include_router(search_router, prefix=v1_prefix)
app.include_router(graph_router, prefix=v1_prefix)
app.include_router(rag_router, prefix=v1_prefix)
app.include_router(jobs_router, prefix=v1_prefix)
app.include_router(health_router, prefix=v1_prefix)
# Root health route
app.include_router(health_router)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )
