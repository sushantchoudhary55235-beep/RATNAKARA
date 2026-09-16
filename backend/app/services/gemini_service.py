import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from google import genai

from app.prompts.oceanai import OCEANAI_SYSTEM_PROMPT


logger = logging.getLogger(__name__)

load_dotenv()

# Timeout for Gemini API calls (seconds)
GEMINI_TIMEOUT = int(os.getenv("GEMINI_TIMEOUT", "30"))

# Application-region representative locations (lat, lon) used for data
# grounding when the user asks about a region rather than a point.
_REGION_CENTROIDS: dict[str, tuple[float, float]] = {
    "arabian sea": (15.0, 62.5),
    "bay of bengal": (15.0, 87.5),
    "indian ocean": (-10.0, 80.0),
}

# Variables the platform can retrieve real values for.
_SUPPORTED_VARIABLES = ("temperature", "salinity", "u_current", "v_current", "sea_surface_height")

# Measurement numbers written with a physical unit in the answer text.
_MEASUREMENT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:°\s*C\b|degrees?\s*Celsius\b|PSU\b)",
    re.IGNORECASE,
)


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

    if context.get("region"):
        parts.append(f"Selected region: {context['region']}")

    if context.get("latitude") is not None and context.get("longitude") is not None:
        parts.append(f"Location: {context['latitude']}N, {context['longitude']}E")

    if context.get("depth") is not None:
        parts.append(f"Depth: {context['depth']} meters")

    if context.get("variable") is not None:
        parts.append(f"Variable of interest: {context['variable']}")

    parts.append("Use this context to provide a more specific and relevant answer.")

    return "\n".join(parts)


def _retrieve_data_context(context: Optional[dict]) -> tuple[str, list[float]]:
    """Retrieve real RATNAKARA values relevant to the chat context.

    The ocean datasets remain the source of truth: this queries the same
    processing layer the API endpoints use (model surface lookup + nearest
    QC-passed Argo observation) so Gemini interprets real data instead of
    inventing measurements.

    Returns ``(data_block, retrieved_values)``. ``data_block`` is empty when
    nothing relevant could be retrieved (dataset missing, land-masked cell,
    no nearby observation) — in that case Gemini is simply not given any
    numbers and must not fabricate any.
    """
    if not context:
        return "", []

    lines: list[str] = []
    numeric_values: list[float] = []

    region = str(context.get("region") or "").strip()
    region_key = region.lower()

    # Region representative location preferred; fall back to the caller's
    # coordinates (e.g. a selected coastal advisory point).
    if region_key in _REGION_CENTROIDS:
        latitude, longitude = _REGION_CENTROIDS[region_key]
        lines.append(
            f"Selected region: {region} (representative location "
            f"{latitude}N, {longitude}E)."
        )
    else:
        latitude = context.get("latitude")
        longitude = context.get("longitude")

    depth = context.get("depth")
    variable = str(context.get("variable") or "").strip().lower()
    if variable not in _SUPPORTED_VARIABLES:
        variable = None

    if variable is not None and latitude is not None and longitude is not None:
        try:
            from app.services.comparison_service import get_model_surface

            surface = get_model_surface(
                variable=variable,
                depth=float(depth) if depth is not None else 0.0,
                time=datetime.now(timezone.utc),
            )
            field = surface["field"]
            lat_idx = int(abs(field.latitude.values - float(latitude)).argmin())
            lon_idx = int(abs(field.longitude.values - float(longitude)).argmin())
            value = float(field.isel(latitude=lat_idx, longitude=lon_idx).values)
            if math.isfinite(value):
                lines.append(
                    f"RATNAKARA MODEL DATA (Copernicus Marine GLORYS12V1): "
                    f"{variable} = {value:.3f} {surface['unit']} at "
                    f"{float(field.latitude.values[lat_idx]):.3f}N, "
                    f"{float(field.longitude.values[lon_idx]):.3f}E, "
                    f"depth {surface['selected_depth']:.2f} m "
                    f"(model time {surface['selected_time']})."
                )
                numeric_values.append(value)
        except Exception as exc:  # dataset missing / land-masked cell: proceed without it
            logger.debug(f"Model context retrieval skipped: {exc}")

        if variable in ("temperature", "salinity"):
            try:
                from app.processing.argo_processor import find_nearest_observation

                observation = find_nearest_observation(
                    variable=variable,
                    latitude=float(latitude),
                    longitude=float(longitude),
                    depth=float(depth) if depth is not None else 0.0,
                    time=datetime.now(timezone.utc),
                )
                if observation is not None:
                    unit = "°C" if variable == "temperature" else "PSU"
                    lines.append(
                        f"NEAREST ARGO OBSERVATION (QC-passed): {variable} = "
                        f"{observation['value']} {unit} at "
                        f"{observation['latitude']}, {observation['longitude']}, "
                        f"{observation['depth']} dbar, {observation['time']} "
                        f"({observation['distance_km']} km and "
                        f"{observation['time_difference_days']} days from the "
                        f"requested location/time)."
                    )
                    numeric_values.append(observation["value"])
            except Exception as exc:  # dataset missing: proceed without it
                logger.debug(f"Argo context retrieval skipped: {exc}")

    if not lines:
        return "", []

    lines.append(
        "Treat the numeric values above as the ONLY measurements available for "
        "this request. If a requested value was not provided above, say the "
        "platform does not currently provide it. Never invent measurements."
    )
    return "\n".join(lines), numeric_values


def _mentions_unverified_measurement(text: str, allowed: list[float]) -> bool:
    """Whether the answer states unit-bearing numbers outside the retrieved data.

    Used purely as a guardrail: when Gemini writes a temperature/PSU value
    that was not retrieved from RATNAKARA data, the verified values are
    appended so the platform's data always remains authoritative.
    """
    if not allowed:
        return False

    for match in _MEASUREMENT_RE.finditer(text):
        try:
            value = float(match.group(1))
        except ValueError:
            continue
        if not any(
            abs(value - allowed_value) <= max(0.05, abs(allowed_value) * 0.01)
            for allowed_value in allowed
        ):
            return True
    return False


def ask_oceanai(question: str, context: Optional[dict] = None) -> str:
    """Send a question to OceanAI via Gemini and return a grounded response.

    Args:
        question: User question about ocean science.
        context: Optional RATNAKAR data context (region, latitude, longitude,
            depth, variable).

    Returns:
        Generated answer string.

    Raises:
        RuntimeError: If API key is missing or Gemini returns empty response.
    """
    client = get_gemini_client()

    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    # Retrieve real RATNAKARA data for the requested context (datasets are
    # the source of truth; Gemini only interprets them).
    data_block, numeric_values = _retrieve_data_context(context)

    # Build the full prompt with optional context
    full_question = question
    if context:
        context_prompt = _build_context_prompt(context)
        full_question = f"{question}{context_prompt}"

    if data_block:
        full_question = (
            f"{full_question}\n\n"
            "[RETRIEVED RATNAKARA DATA — source of truth]\n"
            f"{data_block}"
        )

    try:
        interaction = client.interactions.create(
            model=model,
            system_instruction=OCEANAI_SYSTEM_PROMPT,
            input=full_question,
            timeout=GEMINI_TIMEOUT,
        )
    except Exception as exc:
        logger.error(f"Gemini API call failed: {exc}")
        raise RuntimeError(f"Gemini API error: {type(exc).__name__}") from exc

    answer = interaction.output_text

    if not answer:
        raise RuntimeError("Gemini returned an empty response")

    answer = answer.strip()

    # Guardrail: if the answer states unit-bearing measurements that were
    # not retrieved from RATNAKARA data, restate the verified values so the
    # platform's datasets always remain authoritative.
    if numeric_values and _mentions_unverified_measurement(answer, numeric_values):
        logger.warning("OceanAI answer contained unverified measurements; appending verified values.")
        verified = ", ".join(f"{value:.3f}" for value in numeric_values)
        answer = (
            f"{answer}\n\n"
            f"(Verified RATNAKARA values for this request: {verified}. "
            f"Other numbers in the text above are not from platform data.)"
        )

    return answer