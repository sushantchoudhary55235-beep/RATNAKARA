"""Forecast Truth Engine — validation API endpoint.

Compares numerical model temperature against Argo observations at
comparable locations/depths and returns aggregate accuracy metrics:
Bias, MAE, RMSE.

This is a PROTOTYPE analytical comparison — not official INCOIS
validation.
"""

import math

from fastapi import APIRouter, HTTPException, Query

from app.schemas.validation import ValidationResponse
from app.services.validation_service import get_validation

router = APIRouter(tags=["validation"])


@router.get("/validation", response_model=ValidationResponse)
def read_validation(
    variable: str = Query(
        "temperature",
        description="Variable to validate: 'temperature' or 'salinity'",
    ),
    max_depth_diff: float = Query(
        50.0,
        description="Maximum depth/pressure-proxy difference (dbar) for collocation",
    ),
    max_time_diff_days: float = Query(
        730.0,
        description="Maximum time difference (days) for collocation",
    ),
) -> ValidationResponse:
    """Collocated model-vs-observation comparison producing Bias, MAE, RMSE.

    For each valid Argo observation, the nearest model grid point AND
    nearest model depth level are selected. Only observations within
    the temporal and depth windows are included.

    This is a **prototype analytical comparison** — not official INCOIS
    validation or a certified accuracy statement.
    """
    if variable not in ("temperature", "salinity"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported variable '{variable}'. Only temperature and salinity "
            "are supported for validation (Argo provides these measurements).",
        )
    if not math.isfinite(max_depth_diff) or max_depth_diff < 0:
        raise HTTPException(status_code=400, detail="max_depth_diff must be non-negative")
    if not math.isfinite(max_time_diff_days) or max_time_diff_days < 0:
        raise HTTPException(status_code=400, detail="max_time_diff_days must be non-negative")

    try:
        return get_validation(
            variable=variable,
            max_depth_diff=max_depth_diff,
            max_time_diff_days=max_time_diff_days,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
