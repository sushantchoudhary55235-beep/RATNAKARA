"""Comparison API endpoints (Model vs Reality).

Compares the model value at a point against the nearest valid Argo
observation.  This is a PROTOTYPE analytical comparison — not official
INCOIS validation.
"""

import math
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.processing.argo_processor import (
    ArgoProcessingError,
)
from app.processing.model_processor import ModelProcessingError
from app.schemas.comparison import ComparisonResponse
from app.services.comparison_service import get_comparison

router = APIRouter(tags=["comparison"])


@router.get("/comparison", response_model=ComparisonResponse)
def read_comparison(
    variable: str = Query(..., description="Model variable to compare (e.g. 'temperature', 'salinity')"),
    latitude: float = Query(..., description="Latitude of the comparison point (-90..90)"),
    longitude: float = Query(..., description="Longitude of the comparison point (-180..180)"),
    depth: float = Query(0.0, description="Requested depth in meters (model) / pressure-proxy dbar (Argo)"),
    time: datetime = Query(..., description="ISO 8601 timestamp"),
    max_distance_km: float = Query(
        500.0,
        description="Maximum Haversine distance (km) for candidate observations",
    ),
    max_depth_diff: float = Query(
        100.0,
        description="Maximum depth/pressure-proxy difference (dbar) for candidate observations",
    ),
    max_time_diff_days: float = Query(
        730.0,
        description="Maximum time difference (days) for candidate observations",
    ),
) -> ComparisonResponse:
    """Compare the model value at a point against the nearest valid Argo observation.

    ``depth`` on the model side is in meters; on the Argo side it is the
    pressure/depth proxy in dbar (PRES / PRES_ADJUSTED) — NOT exact
    geometric depth.

    ``time`` selects the nearest model timestep and finds Argo observations
    within ``max_time_diff_days``.  The current prototype model dataset
    contains a single timestep (2026-06-23) so the time difference will
    always reflect the gap to the observation.

    This is a **prototype analytical comparison** — not official INCOIS
    validation or a certified accuracy statement.
    """
    # Boundary validation (400, not 422) — matches observations/anomalies pattern.
    if not math.isfinite(latitude) or not (-90.0 <= latitude <= 90.0):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid latitude '{latitude}': must be between -90 and 90",
        )
    if not math.isfinite(longitude) or not (-180.0 <= longitude <= 180.0):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid longitude '{longitude}': must be between -180 and 180",
        )
    if not math.isfinite(depth) or depth < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid depth '{depth}': must be a non-negative number",
        )

    try:
        return get_comparison(
            variable=variable,
            latitude=latitude,
            longitude=longitude,
            depth=depth,
            time=time,
            max_distance_km=max_distance_km,
            max_depth_diff=max_depth_diff,
            max_time_diff_days=max_time_diff_days,
        )
    except ArgoProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except ModelProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
