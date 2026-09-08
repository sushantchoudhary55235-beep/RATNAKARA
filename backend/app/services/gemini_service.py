import logging
import os
from typing import Optional

from dotenv import load_dotenv
from google import genai

from app.prompts.oceanai import OCEANAI_SYSTEM_PROMPT


logger = logging.getLogger(__name__)

load_dotenv()

# Timeout for Gemini API calls (seconds)
GEMINI_TIMEOUT = int(os.getenv("GEMINI_TIMEOUT", "30"))


def get_gemini_client() -> genai.Client:
    """Create and return a Gemini client instance."""
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    return genai.Client(api_key=api_key)


def _build_context_prompt(context: Optional[dict] = None) -> str:
    """Build a context-aware prompt from optional RATNAKAR data."""
    if not context:
        return ""

    parts = ["\n[USER-provided RATNAKAR data context]"]

    if context.get("latitude") is not None and context.get("longitude") is not None:
        parts.append(f"Location: {context['latitude']}N, {context['longitude']}E")

    if context.get("depth") is not None:
        parts.append(f"Depth: {context['depth']} meters")

    if context.get("variable") is not None:
        parts.append(f"Variable of interest: {context['variable']}")

    parts.append("Use this context to provide a more specific and relevant answer.")

    return "\n".join(parts)


def ask_oceanai(question: str, context: Optional[dict] = None) -> str:
    """Send a question to OceanAI via Gemini and return the response.

    Args:
        question: User question about ocean science.
        context: Optional RATNAKAR data context (latitude, longitude, depth, variable).

    Returns:
        Generated answer string.

    Raises:
        RuntimeError: If API key is missing or Gemini returns empty response.
    """
    client = get_gemini_client()

    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    # Build the full prompt with optional context
    full_question = question
    if context:
        context_prompt = _build_context_prompt(context)
        full_question = f"{question}{context_prompt}"

    try:
        interaction = client.interactions.create(
            model=model,
            system_instruction=OCEANAI_SYSTEM_PROMPT,
            input=full_question,
        )
    except Exception as exc:
        logger.error(f"Gemini API call failed: {exc}")
        raise RuntimeError(f"Gemini API error: {type(exc).__name__}") from exc

    answer = interaction.output_text

    if not answer:
        raise RuntimeError("Gemini returned an empty response")

    return answer.strip()