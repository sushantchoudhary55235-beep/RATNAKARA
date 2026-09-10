"""Forecast Truth Engine — deterministic ocean alert endpoint.

Produces GREEN / YELLOW / RED risk levels using explicitly defined
threshold-based rules applied to validation metrics.

CRITICAL: Risk level is determined SOLELY by deterministic rules.
An LLM or AI system must NOT determine the risk level.
"""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.alert import AlertResponse
from app.services.alert_service import get_alert

router = APIRouter(tags=["alert"])


@router.get("/alert", response_model=AlertResponse)
def read_alert(
    variable: str = Query(
        "temperature",
        description="Variable to assess: 'temperature' or 'salinity'",
    ),
) -> AlertResponse:
    """Deterministic ocean alert based on Forecast Truth Engine validation metrics.

    Risk levels (GREEN / YELLOW / RED) are produced by deterministic
    threshold-based rules applied to Bias, MAE, and RMSE metrics.
    An LLM or AI system does NOT determine the risk level.

    All thresholds are PROTOTYPE / DEMO values clearly labeled as such.
    They are NOT official INCOIS thresholds.
    """
    try:
        return get_alert(variable=variable)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
