"""Pydantic response schema for the deterministic ocean alert endpoint.

Risk levels (GREEN / YELLOW / RED) are produced by deterministic
threshold-based rules, NOT by an LLM or AI system.
"""

from pydantic import BaseModel, Field


class AlertThreshold(BaseModel):
    """A single threshold rule that was evaluated."""

    metric: str = Field(..., description="Metric name (e.g. 'mae', 'rmse', 'bias')")
    value: float = Field(..., description="Actual metric value")
    threshold: float = Field(..., description="Threshold that was applied")
    passed: bool = Field(..., description="True if the metric is within the safe range")


class AlertResult(BaseModel):
    """Deterministic alert result for a single variable."""

    variable: str = Field(..., description="Variable being assessed (e.g. 'temperature')")
    unit: str = Field(..., description="Measurement unit")
    risk_level: str = Field(..., description="'GREEN', 'YELLOW', or 'RED'")
    reason: str = Field(..., description="Plain-language explanation of the risk level")
    thresholds_evaluated: list[AlertThreshold] = Field(
        ..., description="All threshold rules that were checked"
    )
    pair_count: int = Field(..., ge=0, description="Number of model-observation pairs used")
    indicator_type: str = Field(
        "prototype_deterministic_indicator",
        description="Always a prototype indicator, not an official INCOIS warning",
    )


class AlertResponse(BaseModel):
    """Response for GET /api/v1/alert — the Forecast Truth Engine alert."""

    alerts: list[AlertResult] = Field(..., description="Alert results for each assessed variable")
    overall_risk: str = Field(..., description="Highest risk level across all variables")
    mode: str = Field(..., description="'real' when served from local datasets")
    notes: list[str] = Field(default_factory=list, description="Methodology and honesty notes")
