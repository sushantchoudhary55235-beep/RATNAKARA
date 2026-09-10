"""Forecast Truth Engine — deterministic alert service.

Produces GREEN / YELLOW / RED risk levels using explicitly defined
thresholds applied to the validation metrics (Bias, MAE, RMSE).

CRITICAL: The risk level is determined SOLELY by deterministic
threshold-based rules. An LLM or AI system must NOT determine
the risk level. AI may explain or translate the already-determined
result later.

All thresholds are PROTOTYPE / DEMO values clearly labeled as such.
They are NOT official INCOIS thresholds or scientifically validated values.
"""

from __future__ import annotations

from app.schemas.alert import AlertResult, AlertResponse, AlertThreshold
from app.services.validation_service import get_validation


# ---------------------------------------------------------------------------
# PROTOTYPE THRESHOLDS — clearly labeled as demo/analytical values
# ---------------------------------------------------------------------------
# These are NOT official INCOIS thresholds.
# They are configurable prototype parameters for demonstration purposes.

PROTOTYPE_THRESHOLDS: dict[str, dict[str, dict[str, float]]] = {
    "temperature": {
        "green": {
            "mae_max": 2.0,      # °C — MAE must be below this for GREEN
            "rmse_max": 2.5,     # °C — RMSE must be below this for GREEN
            "bias_abs_max": 1.5, # °C — |Bias| must be below this for GREEN
        },
        "yellow": {
            "mae_max": 4.0,      # °C — MAE above GREEN but below this = YELLOW
            "rmse_max": 5.0,     # °C
            "bias_abs_max": 3.0, # °C
        },
        # RED = anything exceeding YELLOW thresholds
    },
    "salinity": {
        "green": {
            "mae_max": 0.3,      # PSU
            "rmse_max": 0.4,     # PSU
            "bias_abs_max": 0.25,# PSU
        },
        "yellow": {
            "mae_max": 0.6,      # PSU
            "rmse_max": 0.8,     # PSU
            "bias_abs_max": 0.5, # PSU
        },
    },
}

NOTES: list[str] = [
    "Forecast Truth Engine — Deterministic Ocean Alert.",
    "Risk levels (GREEN / YELLOW / RED) are produced by deterministic "
    "threshold-based rules, NOT by an LLM or AI system.",
    "All thresholds are PROTOTYPE / DEMO values for demonstration purposes. "
    "They are NOT official INCOIS thresholds or scientifically validated values.",
    "GREEN: Model-observation metrics are within acceptable prototype range.",
    "YELLOW: Model-observation metrics exceed GREEN thresholds but are within "
    "YELLOW thresholds — indicates moderate model-observation discrepancy.",
    "RED: Model-observation metrics exceed all prototype thresholds — "
    "indicates significant model-observation discrepancy.",
    "This is a prototype analytical indicator and not official INCOIS "
    "warning, forecast, or certified anomaly detection.",
]


def get_alert(
    *,
    variable: str = "temperature",
) -> AlertResponse:
    """Run deterministic alert assessment for the given variable."""
    if variable not in PROTOTYPE_THRESHOLDS:
        raise ValueError(
            f"Unsupported variable '{variable}'. "
            f"Supported variables: {', '.join(sorted(PROTOTYPE_THRESHOLDS))}"
        )

    # --- Get validation metrics from the Forecast Truth Engine ---
    validation = get_validation(variable=variable)
    metrics = validation.metrics

    # --- Apply deterministic threshold rules ---
    thresholds_config = PROTOTYPE_THRESHOLDS[variable]
    green = thresholds_config["green"]
    yellow = thresholds_config["yellow"]

    # Evaluate each metric against thresholds
    mae_eval = _evaluate_metric("mae", metrics.mae, green["mae_max"], yellow["mae_max"])
    rmse_eval = _evaluate_metric("rmse", metrics.rmse, green["rmse_max"], yellow["rmse_max"])
    bias_eval = _evaluate_metric("bias", abs(metrics.bias), green["bias_abs_max"], yellow["bias_abs_max"])

    evaluations = [mae_eval, rmse_eval, bias_eval]

    # Deterministic risk level: worst-case across all metrics
    # GREEN only if ALL metrics pass GREEN thresholds
    # RED if ANY metric exceeds YELLOW thresholds
    # YELLOW otherwise
    worst_level = "GREEN"
    for ev in evaluations:
        if ev.risk == "RED":
            worst_level = "RED"
            break
        elif ev.risk == "YELLOW":
            worst_level = "YELLOW"

    # Build reason string
    reason = _build_reason(worst_level, variable, evaluations)

    alert = AlertResult(
        variable=variable,
        unit=validation.unit,
        risk_level=worst_level,
        reason=reason,
        thresholds_evaluated=[
            AlertThreshold(
                metric=ev.metric,
                value=ev.value,
                threshold=ev.green_threshold if ev.risk == "GREEN" else ev.yellow_threshold,
                passed=(ev.risk == "GREEN"),
            )
            for ev in evaluations
        ],
        pair_count=metrics.pair_count,
    )

    return AlertResponse(
        alerts=[alert],
        overall_risk=worst_level,
        mode="real",
        notes=list(NOTES),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _MetricEval:
    """Internal result of evaluating a single metric."""
    def __init__(self, metric: str, value: float, green_threshold: float, yellow_threshold: float):
        self.metric = metric
        self.value = value
        self.green_threshold = green_threshold
        self.yellow_threshold = yellow_threshold
        if value <= green_threshold:
            self.risk = "GREEN"
        elif value <= yellow_threshold:
            self.risk = "YELLOW"
        else:
            self.risk = "RED"


def _evaluate_metric(
    metric_name: str,
    value: float,
    green_max: float,
    yellow_max: float,
) -> _MetricEval:
    """Evaluate a single metric against GREEN and YELLOW thresholds."""
    return _MetricEval(metric_name, value, green_max, yellow_max)


def _build_reason(
    risk_level: str,
    variable: str,
    evaluations: list[_MetricEval],
) -> str:
    """Build a plain-language reason string for the risk level."""
    if risk_level == "GREEN":
        return (
            f"All {variable} model-observation metrics are within "
            f"acceptable prototype thresholds. Model performance is GREEN."
        )

    # Find which metrics triggered YELLOW or RED
    flagged = [ev for ev in evaluations if ev.risk != "GREEN"]
    flag_descriptions = []
    for ev in flagged:
        flag_descriptions.append(
            f"{ev.metric.upper()} = {ev.value} "
            f"(threshold: {ev.green_threshold if ev.risk == 'YELLOW' else ev.yellow_threshold})"
        )

    if risk_level == "YELLOW":
        return (
            f"Moderate {variable} model-observation discrepancy detected. "
            f"Metrics exceeding GREEN thresholds: {'; '.join(flag_descriptions)}. "
            f"Overall status: YELLOW."
        )

    # RED
    red_flags = [ev for ev in evaluations if ev.risk == "RED"]
    red_descriptions = []
    for ev in red_flags:
        red_descriptions.append(
            f"{ev.metric.upper()} = {ev.value} exceeds YELLOW threshold {ev.yellow_threshold}"
        )
    return (
        f"Significant {variable} model-observation discrepancy detected. "
        f"Metrics exceeding all prototype thresholds: {'; '.join(red_descriptions)}. "
        f"Overall status: RED."
    )
