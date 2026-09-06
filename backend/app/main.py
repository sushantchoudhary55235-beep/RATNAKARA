"""SAGARA Ocean Analytics API - FastAPI application entry point."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.metadata import router as metadata_router
from app.api.model_field import router as model_field_router

app = FastAPI(
    title="SAGARA Ocean Analytics API",
    description=(
        "SAGARA (Smart 3D Ocean Analytics & Reality Assessment) integrates numerical "
        "ocean model outputs and in-situ observations for interactive 3D visualization "
        "and analysis of the ocean."
    ),
    version="0.1.0",
)

# CORS for local frontend development (Vite on 5173, Create React App on 3000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
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
    """Health check - stays fast and does not load any datasets."""
    return {"status": "ok", "service": "SAGARA backend"}


# All application APIs except /health use the /api/v1 prefix.
app.include_router(metadata_router, prefix="/api/v1")
app.include_router(model_field_router, prefix="/api/v1")