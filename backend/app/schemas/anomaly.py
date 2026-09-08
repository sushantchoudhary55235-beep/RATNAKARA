"""Pydantic response schemas for the anomaly detection endpoint.

The anomaly endpoint returns a PROTOTYPE analytical indicator built from
model-vs-observation differences. It is NOT an official INCOIS warning.
"""

from pydantic import BaseModel, Field


class AnomalyLocation(BaseModel):
    """Observation location for an anomaly candidate."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class AnomalyModelValue(BaseModel):
    """Expected (model) value information."""

    source: str = Field("Copernicus Marine", description="Model data source")


class AnomalyObservation(BaseModel):
    """Observed (Argo) value information."""

    id: str = Field(..., description="Deterministic Argo observation ID")
    source: str = Field("Argo", description="Observation data source")


class Anomaly(BaseModel):
    """A single model-vs-observation anomaly candidate.

    ``depth`` is the Argo pressure/depth proxy in dbar.
    """

    status: str = Field(..., description="'NORMAL' or 'WARNING' (prototype analytical status)")
    indicator_type: str = Field(
        "prototype_analytical_indicator",
        description="Always a prototype analytical indicator, not an official warning",
    )
    variable: str
    unit: str
    location: AnomalyLocation
    depth: float = Field(..., description="Pressure/depth proxy in dbar (PRES/PRES_ADJUSTED)")
    time: str = Field(..., description="ISO-8601 observation timestamp")
    observed_value: float = Field(..., description="Argo observation value")
    expected_value: float = Field(..., description="Model value at the observation location")
    difference: float = Field(..., description="observed_value - expected_value")
    absolute_difference: float = Field(..., description="abs(observed_value - expected_value)")
    threshold: float = Field(..., description="Threshold actually used for this result")
    threshold_type: str = Field(
        "prototype analytical threshold",
        description="Configurable prototype parameter, not an INCOIS-approved threshold",
    )
    observation: AnomalyObservation
    model: AnomalyModelValue
    message: str = Field(..., description="Plain-language message for this candidate")


class AnomalyResponse(BaseModel):
    """Response for GET /api/v1/anomalies."""

    count: int = Field(..., ge=0, description="Number of anomaly candidates returned (bounded, max 500)")
    status: str = Field(..., description="Overall status: 'WARNING' if any candidate is WARNING, else 'NORMAL'")
    indicator_type: str = Field(
        "prototype_analytical_indicator",
        description="Prototype analytical indicator, not an official INCOIS warning",
    )
    variable: str
    unit: str
    threshold: float = Field(..., description="Threshold actually used")
    threshold_type: str = Field(
        "prototype analytical threshold",
        description="Configurable prototype parameter, not an INCOIS-approved threshold",
    )
    mode: str = Field(..., description="'real' when served from the local real datasets")
    anomalies: list[Anomaly] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list, description="Scientific-honesty and processing notes")