"""Ocean model field endpoints."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.processing.model_processor import (
    MAX_MAX_POINTS,
    MIN_MAX_POINTS,
    ModelProcessingError,
    get_variable_map,
)
from app.schemas.model import ModelFieldResponse
from app.services.model_service import get_model_field

router = APIRouter(tags=["model-field"])


@router.get("/model-field", response_model=ModelFieldResponse)
def read_model_field(
    variable: str = Query(..., description="API variable name"),
    depth: float = Query(..., description="Requested depth in meters (nearest level is used)"),
    time: datetime = Query(..., description="ISO 8601 timestamp (nearest timestep is used)"),
    lat_min: float | None = Query(None, description="Minimum latitude (degrees north)"),
    lat_max: float | None = Query(None, description="Maximum latitude (degrees north)"),
    lon_min: float | None = Query(None, description="Minimum longitude (degrees east)"),
    lon_max: float | None = Query(None, description="Maximum longitude (degrees east)"),
    max_points: int = Query(
        5000,
        ge=MIN_MAX_POINTS,
        le=MAX_MAX_POINTS,
        description="Approximate maximum number of returned points (downsampling target)",
    ),
) -> ModelFieldResponse:
    """Retrieve a 2-D ocean model field slice as visualization-ready points."""
    if variable not in get_variable_map():
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported variable '{variable}'. Supported variables: "
            + ", ".join(sorted(get_variable_map())),
        )
    try:
        return get_model_field(
            variable=variable,
            depth=depth,
            time=time,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            max_points=max_points,
        )
    except ModelProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc