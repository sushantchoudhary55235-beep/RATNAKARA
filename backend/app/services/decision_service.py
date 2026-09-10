"""Deterministic ocean decision-support service.

Combines multiple real data inputs into a single composite ocean condition
assessment using explicit threshold-based rules.

CRITICAL: All decisions are produced by deterministic rules, NOT by an LLM.
AI may explain or translate the already-determined result later.

All thresholds are PROTOTYPE / DEMO values clearly labeled as such.
They are NOT official INCOIS thresholds.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from app.schemas.decision import (
    DecisionResponse,
    DecisionResult,
    SupportingMetric,
)
from app.services.alert_service import get_alert
from app.services.validation_service import get_validation

# ---------------------------------------------------------------------------
# PROTOTYPE THRESHOLDS — clearly labeled as demo values
# ---------------------------------------------------------------------------

# Current speed thresholds (m/s)
CURRENT_SPEED_THRESHOLDS = {
    "green_max": 0.5,   # m/s — calm
    "yellow_max": 1.5,  # m/s — moderate
    # RED = anything above yellow
}

# Data freshness thresholds (days)
DATA_FRESHNESS_THRESHOLDS = {
    "green_max": 7,    # days — fresh
    "yellow_max": 30,  # days — acceptable
    # RED = anything above yellow
}

# Surface temperature thresholds (°C) — tropical Indian Ocean range
TEMPERATURE_THRESHOLDS = {
    "green_min": 20.0,  # °C
    "green_max": 30.0,  # °C
    "yellow_min": 15.0, # °C
    "yellow_max": 32.0, # °C
    # RED = below yellow_min or above yellow_max
}

# Model timestep (known from dataset inspection)
MODEL_TIMESTAMP = "2026-06-23T00:00:00"

NOTES = [
    "Deterministic Ocean Decision-Support Layer.",
    "Composite status is produced by deterministic threshold-based rules, NOT by an LLM.",
    "Inputs: model-observation validation, ocean current speed, data freshness, temperature.",
    "All thresholds are PROTOTYPE / DEMO values for demonstration purposes.",
    "They are NOT official INCOIS thresholds or scientifically validated values.",
    "This is a prototype analytical indicator and not an official INCOIS warning,",
    "forecast, or certified ocean condition assessment.",
]


def get_decision() -> DecisionResponse:
    """Compute composite ocean decision from multiple real data sources."""
    now = datetime.now(timezone.utc)

    # --- 1. Validation confidence (from existing alert engine) ---
    try:
        alert_resp = get_alert(variable="temperature")
        validation_status = alert_resp.overall_risk
        validation_reason = (
            alert_resp.alerts[0].reason if alert_resp.alerts else "No validation data"
        )
        validation_metrics = alert_resp.alerts[0].thresholds_evaluated if alert_resp.alerts else []
        pair_count = alert_resp.alerts[0].pair_count if alert_resp.alerts else 0
    except Exception:
        validation_status = "YELLOW"
        validation_reason = "Validation data unavailable"
        validation_metrics = []
        pair_count = 0

    # --- 2. Data freshness ---
    try:
        model_dt = datetime.fromisoformat(MODEL_TIMESTAMP.replace("Z", "+00:00"))
        freshness_days = (now - model_dt).days
        freshness_status = _evaluate_freshness(freshness_days)
    except Exception:
        freshness_days = -1
        freshness_status = "YELLOW"

    # --- 3. Current speed ---
    # We compute this from actual model U/V data
    max_current_speed, current_status = _evaluate_current_speed()

    # --- 4. Surface temperature ---
    avg_surface_temp, temp_status = _evaluate_temperature()

    # --- Build supporting metrics ---
    supporting = [
        SupportingMetric(
            name="Model-Observation Validation",
            value=f"MAE {alert_resp.alerts[0].thresholds_evaluated[0].value if validation_metrics else 'N/A'}°C"
            if validation_metrics
            else "N/A",
            threshold="GREEN ≤ 2.0, YELLOW ≤ 4.0",
            status=validation_status,
        ),
        SupportingMetric(
            name="Current Speed (max)",
            value=f"{max_current_speed:.2f} m/s" if max_current_speed >= 0 else "N/A",
            threshold=f"GREEN ≤ {CURRENT_SPEED_THRESHOLDS['green_max']}, YELLOW ≤ {CURRENT_SPEED_THRESHOLDS['yellow_max']}",
            status=current_status,
        ),
        SupportingMetric(
            name="Data Freshness",
            value=f"{freshness_days} days" if freshness_days >= 0 else "N/A",
            threshold=f"GREEN ≤ {DATA_FRESHNESS_THRESHOLDS['green_max']}d, YELLOW ≤ {DATA_FRESHNESS_THRESHOLDS['yellow_max']}d",
            status=freshness_status,
        ),
        SupportingMetric(
            name="Surface Temperature",
            value=f"{avg_surface_temp:.1f}°C" if avg_surface_temp is not None else "N/A",
            threshold=f"GREEN {TEMPERATURE_THRESHOLDS['green_min']}–{TEMPERATURE_THRESHOLDS['green_max']}°C",
            status=temp_status,
        ),
    ]

    # --- Composite status: worst-case across all factors ---
    all_statuses = [validation_status, freshness_status, current_status, temp_status]
    if "RED" in all_statuses:
        overall = "RED"
    elif "YELLOW" in all_statuses:
        overall = "YELLOW"
    else:
        overall = "GREEN"

    # --- Build summary ---
    summary = _build_summary(overall)
    reason = _build_reason(overall, validation_reason, freshness_days, max_current_speed, avg_surface_temp)

    decision = DecisionResult(
        status=overall,
        summary=summary,
        reason=reason,
        supporting_metrics=supporting,
        model_time=MODEL_TIMESTAMP,
        data_sources=[
            "Copernicus Marine Model (arabian_sea_model.nc)",
            "INCOIS Argo Observations (arabian_sea_argo.nc)",
            "Forecast Truth Engine (validation metrics)",
        ],
    )

    return DecisionResponse(
        decision=decision,
        overall_status=overall,
        mode="real",
        notes=list(NOTES),
    )


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------

def _evaluate_freshness(days: int) -> str:
    """Evaluate data freshness against prototype thresholds."""
    if days <= DATA_FRESHNESS_THRESHOLDS["green_max"]:
        return "GREEN"
    elif days <= DATA_FRESHNESS_THRESHOLDS["yellow_max"]:
        return "YELLOW"
    return "RED"


def _evaluate_current_speed() -> tuple[float, str]:
    """Fetch actual max current speed from the model and evaluate."""
    try:
        from app.services.model_field_service import get_model_field

        u_data = get_model_field(
            variable="u_current", depth=0, time=MODEL_TIMESTAMP, max_points=500
        )
        v_data = get_model_field(
            variable="v_current", depth=0, time=MODEL_TIMESTAMP, max_points=500
        )

        # Build lookup for U values by lat/lon key
        u_map = {}
        for pt in u_data.points:
            key = (round(pt.latitude, 1), round(pt.longitude, 1))
            u_map[key] = pt.value

        max_speed = 0.0
        for v_pt in v_data.points:
            key = (round(v_pt.latitude, 1), round(v_pt.longitude, 1))
            u_val = u_map.get(key, 0.0)
            speed = math.sqrt(u_val ** 2 + v_pt.value ** 2)
            if speed > max_speed:
                max_speed = speed

        if max_speed <= CURRENT_SPEED_THRESHOLDS["green_max"]:
            status = "GREEN"
        elif max_speed <= CURRENT_SPEED_THRESHOLDS["yellow_max"]:
            status = "YELLOW"
        else:
            status = "RED"

        return max_speed, status

    except Exception:
        return -1.0, "YELLOW"


def _evaluate_temperature() -> tuple[float | None, str]:
    """Fetch actual surface temperature and evaluate against thresholds."""
    try:
        from app.services.model_field_service import get_model_field

        temp_data = get_model_field(
            variable="temperature", depth=0, time=MODEL_TIMESTAMP, max_points=500
        )

        if not temp_data.points:
            return None, "YELLOW"

        values = [pt.value for pt in temp_data.points if pt.value is not None and not math.isnan(pt.value)]
        if not values:
            return None, "YELLOW"

        avg_temp = sum(values) / len(values)

        t = TEMPERATURE_THRESHOLDS
        if t["green_min"] <= avg_temp <= t["green_max"]:
            status = "GREEN"
        elif t["yellow_min"] <= avg_temp <= t["yellow_max"]:
            status = "YELLOW"
        else:
            status = "RED"

        return avg_temp, status

    except Exception:
        return None, "YELLOW"


def _build_summary(status: str) -> str:
    """One-line summary for quick reading."""
    if status == "GREEN":
        return "Ocean conditions within normal operational range."
    elif status == "YELLOW":
        return "Moderate ocean conditions — monitor recommended."
    return "Significant ocean anomalies detected — caution advised."


def _build_reason(
    status: str,
    validation_reason: str,
    freshness_days: int,
    max_current_speed: float,
    avg_surface_temp: float | None,
) -> str:
    """Detailed reason for the decision."""
    parts = []

    if status == "GREEN":
        parts.append("All monitored indicators are within acceptable prototype thresholds.")
    elif status == "YELLOW":
        parts.append("One or more indicators exceed GREEN thresholds.")
    else:
        parts.append("One or more indicators exceed YELLOW thresholds.")

    parts.append(f"Validation: {validation_reason}")

    if freshness_days >= 0:
        if freshness_days > DATA_FRESHNESS_THRESHOLDS["yellow_max"]:
            parts.append(f"Data is {freshness_days} days old (exceeds {DATA_FRESHNESS_THRESHOLDS['yellow_max']}d prototype threshold).")
        elif freshness_days > DATA_FRESHNESS_THRESHOLDS["green_max"]:
            parts.append(f"Data is {freshness_days} days old.")

    if max_current_speed >= 0:
        if max_current_speed > CURRENT_SPEED_THRESHOLDS["yellow_max"]:
            parts.append(f"Max current speed {max_current_speed:.2f} m/s exceeds {CURRENT_SPEED_THRESHOLDS['yellow_max']} m/s threshold.")
        elif max_current_speed > CURRENT_SPEED_THRESHOLDS["green_max"]:
            parts.append(f"Max current speed {max_current_speed:.2f} m/s is moderate.")

    if avg_surface_temp is not None:
        t = TEMPERATURE_THRESHOLDS
        if avg_surface_temp < t["yellow_min"] or avg_surface_temp > t["yellow_max"]:
            parts.append(f"Surface temperature {avg_surface_temp:.1f}°C is outside {t['yellow_min']}–{t['yellow_max']}°C range.")
        elif avg_surface_temp < t["green_min"] or avg_surface_temp > t["green_max"]:
            parts.append(f"Surface temperature {avg_surface_temp:.1f}°C is outside typical {t['green_min']}–{t['green_max']}°C range.")

    return " ".join(parts)
