"""Dataset metadata endpoints."""

from fastapi import APIRouter

from app.schemas.metadata import MetadataResponse
from app.services.metadata_service import get_metadata

router = APIRouter(tags=["metadata"])


@router.get("/metadata", response_model=MetadataResponse)
def read_metadata() -> MetadataResponse:
    """Return metadata about the datasets discovered during Phase 1."""
    return get_metadata()