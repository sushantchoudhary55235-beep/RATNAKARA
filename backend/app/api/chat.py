import logging

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini_service import ask_oceanai


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api/v1/chat",
    tags=["OceanAI"],
)


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    """OceanAI chat endpoint.

    Accepts a question about ocean science and returns a Gemini-generated answer.
    Optionally accepts RATNAKAR data context for data-aware responses.
    """
    try:
        # Convert context to dict if provided
        context_dict = None
        if request.context:
            context_dict = {
                "latitude": request.context.latitude,
                "longitude": request.context.longitude,
                "depth": request.context.depth,
                "variable": request.context.variable,
            }

        answer = ask_oceanai(request.question, context=context_dict)

        return ChatResponse(answer=answer)

    except RuntimeError as exc:
        # Log the actual error but return a safe message to the client
        logger.error(f"Gemini error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="OceanAI service error. Please try again later.",
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise

    except Exception as exc:
        # Log the actual error but return a safe message to the client
        logger.error(f"Unexpected chat error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="OceanAI is temporarily unavailable.",
        )