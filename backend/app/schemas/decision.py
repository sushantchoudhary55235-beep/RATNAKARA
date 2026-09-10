"""Pydantic response schema for the deterministic ocean decision-support endpoint.

Produces a composite ocean condition assessment from multiple real data inputs:
- Model-observation validation metrics
- Ocean current speed
- Data freshness

All decisions are produced by deterministic rules, NOT by an LLM.
"""

from pydantic import BaseModel, Field


class SupportingMetric(BaseModel):
    """A single supporting metric included in the decision."""

    name: str = Field(..., description="Metric name")
    value: str = Field(..., description="Formatted metric value with units")
    threshold: str = Field(
        ..., description="Prototype threshold this was compared against"
    )
    status: str = Field(
        ..., description="Status for this individual metric: GREEN, YELLOW, or RED"
    )


class DecisionResult(BaseModel):
    """Composite ocean decision-support result."""

    status: str = Field(
        ...,
        description="Composite status: GREEN, YELLOW, or RED",
    )
    summary: str = Field(
        ...,
        description="One-line summary for quick reading",
    )
    reason: str = Field(
        ...,
        description="Detailed reason explaining the decision",
    )
    supporting_metrics: list[SupportingMetric] = Field(
        default_factory=list,
        description="Individual metrics that contributed to the decision",
    )
    model_time: str = Field(
        ...,
        description="Timestamp of the model data used",
    )
    data_sources: list[str] = Field(
        default_factory=list,
        description="Data sources used in this assessment",
    )


class DecisionResponse(BaseModel):
    """Response for GET /api/v1/decision — composite decision-support result."""

    decision: DecisionResult
    overall_status: str = Field(
        ...,
        description="Highest risk level (GREEN / YELLOW / RED)",
    )
    mode: str = Field("real", description="Data mode")
    notes: list[str] = Field(
        default_factory=list,
        description="Prototype / honesty notes",
    )
