"""Smart Ocean Anomaly Detection endpoint (prototype analytical indicator)."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.processing.argo_processor import (
    DEFAULT_MAX_ANOMALIES,
    MAX_MAX_ANOMALIES,
    ArgoProcessingError,
)
from app.processing.model_processor import ModelProcessingError
from app.schemas.anomaly import AnomalyResponse
from app.services.anomaly_service import PROTOTYPE_THRESHOLDS, get_anomalies

router = APIRouter(tags=["anomalies"])

_SUPPORTED = ", ".join(sorted(PROTOTYPE_THRESHOLDS))


@router.get("/anomalies", response_model=AnomalyResponse)
def read_anomalies(
    variable: str = Query(..., description=f"Anomaly variable: {_SUPPORTED} (u_current/v_current are unsupported)"),
    latitude: float | None = Query(None, description="Center latitude for radius filtering (validated -> 400)"),
    longitude: float | None = Query(None, description="Center longitude for radius filtering (validated -> 400)"),
    radius_km: float | None = Query(None, description="Haversine radius (km) around (latitude, longitude); requires both (validated -> 400)"),
    depth: float | None = Query(None, description="Target pressure/depth proxy in dbar (tolerance filter; validated -> 400)"),
    depth_tolerance: float = Query(25.0, description="Depth tolerance window in dbar (validated -> 400)"),
    time: datetime | None = Query(None, description="Target timestamp (ISO 8601); observations within the time tolerance are scanned"),
    time_tolerance_days: float = Query(365.0, description="Time tolerance in days (validated -> 400)"),
    threshold: float | None = Query(None, description="Prototype analytical threshold override (defaults: temperature 2.0 °C, salinity 0.5 PSU; negative -> 400)"),
    max_results: int = Query(
        DEFAULT_MAX_ANOMALIES,
        ge=1,
        le=MAX_MAX_ANOMALIES,
        description="Maximum returned anomaly candidates (hard cap 500)",
    ),
) -> AnomalyResponse:
    """Scan model-vs-observation differences and return prototype anomaly candidates.

    PROTOTYPE analytical indicator — NOT an official INCOIS warning. The
    threshold is a configurable prototype parameter, not a scientifically
    validated value.
    """
    # Boundary validation (400, not 422/404).
    for name, value, lo, hi in (
        ("latitude", latitude, -90.0, 90.0),
        ("longitude", longitude, -180.0, 180.0),
    ):
        if value is not None and not (lo <= value <= hi):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {name} '{value}': must be between {lo} and {hi}",
            )
    if variable in ("u_current", "v_current"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported anomaly variable '{variable}': the Argo observation "
                "dataset provides temperature and salinity only; current "
                "observations are not fabricated."
            ),
        )
    if variable not in PROTOTYPE_THRESHOLDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported variable '{variable}'. Supported variables: {_SUPPORTED}",
        )

    try:
        return get_anomalies(
            variable=variable,
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            depth=depth,
            depth_tolerance=depth_tolerance,
            time=time,
            time_tolerance_days=time_tolerance_days,
            threshold=threshold,
            max_results=max_results,
        )
    except ArgoProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except ModelProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc