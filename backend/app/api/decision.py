"""Deterministic ocean decision-support API endpoint.

Produces a composite ocean condition assessment from multiple real data inputs
using explicit threshold-based rules. Not an AI-generated risk engine.
"""

import logging

from fastapi import APIRouter

from app.schemas.decision import DecisionResponse
from app.services.decision_service import get_decision

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["DecisionSupport"],
)


@router.get("", response_model=DecisionResponse)
def decision():
    """Deterministic ocean decision-support endpoint.

    Returns a composite ocean condition status (GREEN / YELLOW / RED)
    based on real data inputs:
    - Model-observation validation metrics
    - Ocean current speed
    - Data freshness
    - Surface temperature

    All decisions are produced by deterministic threshold-based rules,
    NOT by an LLM or AI system.
    """
    try:
        return get_decision()
    except Exception as exc:
        logger.error(f"Decision-support error: {exc}")
        raise
