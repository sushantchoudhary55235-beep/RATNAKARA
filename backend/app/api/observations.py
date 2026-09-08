"""Observation endpoints (Argo now; glider reserved for later phases)."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.processing.argo_processor import (
    DEFAULT_MAX_OBS,
    ArgoProcessingError,
    argo_dataset_path,
)
from app.schemas.observation import ObservationResponse
from app.services.observation_service import get_observations

router = APIRouter(tags=["observations"])


@router.get("/observations")
def read_observations(
    source: str = Query("argo", description="Data source: 'argo' (real data), 'all'. 'glider' is reserved until verified data exists."),
    latitude: float | None = Query(None, description="Center latitude for radius filtering (-90..90)"),
    longitude: float | None = Query(None, description="Center longitude for radius filtering (-180..180)"),
    lat_min: float | None = Query(None, description="Minimum latitude (-90..90)"),
    lat_max: float | None = Query(None, description="Maximum latitude (-90..90)"),
    lon_min: float | None = Query(None, description="Minimum longitude (-180..180)"),
    lon_max: float | None = Query(None, description="Maximum longitude (-180..180)"),
    depth: float | None = Query(None, description="Target pressure/depth in dbar (tolerance-based filter)"),
    depth_tolerance: float = Query(25.0, ge=0, description="Depth tolerance window in dbar for the depth filter"),
    time: datetime | None = Query(None, description="Target timestamp (ISO 8601); observations within the time tolerance are returned"),
    time_tolerance_days: float = Query(30.0, ge=0, description="Time tolerance in days around the requested timestamp"),
    radius_km: float | None = Query(None, ge=0, description="Radius in km around (latitude, longitude); requires both"),
    variable: str | None = Query(None, description="Keep only observations reporting this measurement: temperature, salinity, temp_sal"),
    max_observations: int = Query(
        DEFAULT_MAX_OBS,
        ge=1,
        le=DEFAULT_MAX_OBS,
        description="Maximum number of returned observations (deterministic downsampling above this)",
    ),
) -> ObservationResponse:
    """Retrieve in-situ observations (Argo) filtered by region/depth/time/radius.

    ``depth`` values are the Argo pressure (PRES/PRES_ADJUSTED) in dbar
    used as a depth proxy, NOT exact geometric depth.
    """
    # Basic coordinate validation performed at the boundary (400, not 404).
    for name, value, lo, hi in (
        ("latitude", latitude, -90.0, 90.0),
        ("lat_min", lat_min, -90.0, 90.0),
        ("lat_max", lat_max, -90.0, 90.0),
        ("longitude", longitude, -180.0, 180.0),
        ("lon_min", lon_min, -180.0, 180.0),
        ("lon_max", lon_max, -180.0, 180.0),
    ):
        if value is not None and not (lo <= value <= hi):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {name} '{value}': must be between {lo} and {hi}",
            )
    if radius_km is not None and (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=400,
            detail="radius_km requires BOTH latitude and longitude (the circle center)",
        )
    if radius_km is not None and (lat_min is not None or lat_max is not None or lon_min is not None or lon_max is not None):
        raise HTTPException(
            status_code=400,
            detail="radius_km uses latitude/longitude as center; do not combine it with lat_min/lat_max/lon_min/lon_max",
        )

    try:
        return get_observations(
            source=source,
            latitude=latitude,
            longitude=longitude,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            depth=depth,
            depth_tolerance=depth_tolerance,
            time=time,
            time_tolerance_days=time_tolerance_days,
            radius_km=radius_km,
            variable=variable,
            max_observations=max_observations,
        )
    except ArgoProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def dataset_available() -> bool:
    """Whether the real Argo dataset file is present (used by diagnostics)."""
    return argo_dataset_path().is_file()