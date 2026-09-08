from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ChatContext(BaseModel):
    """Optional RATNAKAR data context for data-aware chat responses."""

    latitude: Optional[float] = Field(
        None,
        ge=-90.0,
        le=90.0,
        description="Latitude for location context (-90 to 90)",
    )
    longitude: Optional[float] = Field(
        None,
        ge=-180.0,
        le=180.0,
        description="Longitude for location context (-180 to 180)",
    )
    depth: Optional[float] = Field(
        None,
        ge=0.0,
        description="Depth in meters for context",
    )
    variable: Optional[str] = Field(
        None,
        description="Ocean variable of interest (e.g., temperature, salinity)",
    )


class ChatRequest(BaseModel):
    """Request schema for OceanAI chat endpoint."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User question about ocean science",
    )
    context: Optional[ChatContext] = Field(
        None,
        description="Optional RATNAKAR data context for data-aware responses",
    )

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Question cannot be empty or whitespace-only")

        return value


class ChatResponse(BaseModel):
    """Response schema for OceanAI chat endpoint."""

    answer: str = Field(
        ...,
        description="OceanAI-generated answer from Gemini",
    )