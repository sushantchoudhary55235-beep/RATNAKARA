"""RATNAKARA Ocean Analytics API - FastAPI application entry point."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.anomalies import router as anomalies_router
from app.api.comparison import router as comparison_router
from app.api.metadata import router as metadata_router
from app.api.model_field import router as model_field_router
from app.api.observations import router as observations_router
from app.api.chat import router as chat_router

app = FastAPI(
    title="SAGARA Ocean Analytics API",
    description=(
        "SAGARA (Smart 3D Ocean Analytics & Reality Assessment) integrates numerical "
        "ocean model outputs and in-situ observations for interactive 3D visualization "
        "and analysis of the ocean."
    ),
    version="0.1.0",
)

# CORS for local frontend development.
# Supports Vite dev (5173), Vite preview (4173), Create React App (3000),
# and common SIH demo ports.
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return JSON instead of raw HTML for unexpected application errors."""
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health_check():
    """Health check - stays fast and does not load any datasets.

    Returns basic status and dataset availability without opening files.
    """
    from pathlib import Path

    # Check dataset availability without loading them
    data_dir = Path(__file__).resolve().parents[2] / "data" / "sample"
    model_file = data_dir / "arabian_sea_model.nc"
    argo_file = data_dir / "arabian_sea_argo.nc"

    return {
        "status": "ok",
        "service": "SAGARA backend",
        "datasets": {
            "model": model_file.is_file(),
            "argo": argo_file.is_file(),
        },
    }


# All application APIs except /health use the /api/v1 prefix.
app.include_router(metadata_router, prefix="/api/v1")
app.include_router(model_field_router, prefix="/api/v1")
app.include_router(observations_router, prefix="/api/v1")
app.include_router(comparison_router, prefix="/api/v1")
app.include_router(anomalies_router, prefix="/api/v1")
app.include_router(chat_router)
