"""Tests for OceanAI chat endpoint.

All tests mock the Gemini API to avoid real API calls during testing.
"""

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_gemini():
    """Mock the Gemini client and its interactions.create method."""
    with patch("app.services.gemini_service.get_gemini_client") as mock:
        client = MagicMock()
        mock.return_value = client

        # Default successful interaction
        interaction = MagicMock()
        interaction.output_text = "Ocean salinity is the concentration of dissolved salts in seawater, typically around 35 PSU in open ocean."
        client.interactions.create.return_value = interaction

        yield client


@pytest.fixture
def mock_env_with_key():
    """Ensure GEMINI_API_KEY is set in environment for tests."""
    with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key-not-real", "GEMINI_MODEL": "gemini-3.8-flash"}):
        yield


# ---------------------------------------------------------------------------
# Test: Successful chat
# ---------------------------------------------------------------------------


class TestChatSuccess:
    def test_successful_chat_returns_200(self, client, mock_gemini, mock_env_with_key):
        """POST /api/v1/chat with valid question returns 200."""
        response = client.post(
            "/api/v1/chat",
            json={"question": "What is ocean salinity?"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert isinstance(data["answer"], str)
        assert len(data["answer"]) > 0

    def test_successful_chat_with_context(self, client, mock_gemini, mock_env_with_key):
        """POST /api/v1/chat with optional context returns 200."""
        response = client.post(
            "/api/v1/chat",
            json={
                "question": "What is the temperature here?",
                "context": {
                    "latitude": 18.5,
                    "longitude": 72.8,
                    "depth": 50,
                    "variable": "temperature",
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert len(data["answer"]) > 0

    def test_chat_calls_gemini_with_question(self, client, mock_gemini, mock_env_with_key):
        """Verify that the question is passed to Gemini."""
        client.post(
            "/api/v1/chat",
            json={"question": "Explain ocean currents"},
        )

        # Verify Gemini was called
        mock_gemini.interactions.create.assert_called_once()
        call_args = mock_gemini.interactions.create.call_args
        assert "Explain ocean currents" in call_args.kwargs.get("input", "") or "Explain ocean currents" in str(call_args)

    def test_chat_includes_context_in_prompt(self, client, mock_gemini, mock_env_with_key):
        """Verify that context is included in the prompt to Gemini."""
        client.post(
            "/api/v1/chat",
            json={
                "question": "What is the temperature here?",
                "context": {
                    "latitude": 18.5,
                    "longitude": 72.8,
                    "depth": 50,
                },
            },
        )

        # Verify context was included
        call_args = mock_gemini.interactions.create.call_args
        input_text = call_args.kwargs.get("input", "")
        assert "18.5" in input_text
        assert "72.8" in input_text
        assert "50" in input_text


# ---------------------------------------------------------------------------
# Test: Validation errors
# ---------------------------------------------------------------------------


class TestChatValidation:
    def test_empty_question_returns_422(self, client):
        """POST /api/v1/chat with empty question returns 422."""
        response = client.post(
            "/api/v1/chat",
            json={"question": ""},
        )

        assert response.status_code == 422

    def test_whitespace_question_returns_422(self, client):
        """POST /api/v1/chat with whitespace-only question returns 422."""
        response = client.post(
            "/api/v1/chat",
            json={"question": "   "},
        )

        assert response.status_code == 422

    def test_missing_question_returns_422(self, client):
        """POST /api/v1/chat with missing question field returns 422."""
        response = client.post(
            "/api/v1/chat",
            json={},
        )

        assert response.status_code == 422

    def test_invalid_context_latitude_returns_422(self, client):
        """POST /api/v1/chat with invalid latitude in context returns 422."""
        response = client.post(
            "/api/v1/chat",
            json={
                "question": "What is here?",
                "context": {"latitude": 100.0},
            },
        )

        assert response.status_code == 422

    def test_invalid_context_longitude_returns_422(self, client):
        """POST /api/v1/chat with invalid longitude in context returns 422."""
        response = client.post(
            "/api/v1/chat",
            json={
                "question": "What is here?",
                "context": {"longitude": 200.0},
            },
        )

        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Test: Gemini failure handling
# ---------------------------------------------------------------------------


class TestChatGeminiFailure:
    def test_gemini_runtime_error_returns_500(self, client, mock_gemini, mock_env_with_key):
        """POST /api/v1/chat returns 500 when Gemini raises RuntimeError."""
        mock_gemini.interactions.create.side_effect = RuntimeError("API key invalid")

        response = client.post(
            "/api/v1/chat",
            json={"question": "What is SST?"},
        )

        assert response.status_code == 500
        data = response.json()
        assert "detail" in data

    def test_gemini_empty_response_returns_500(self, client, mock_gemini, mock_env_with_key):
        """POST /api/v1/chat returns 500 when Gemini returns empty response."""
        interaction = MagicMock()
        interaction.output_text = ""
        mock_gemini.interactions.create.return_value = interaction

        response = client.post(
            "/api/v1/chat",
            json={"question": "What is SST?"},
        )

        assert response.status_code == 500

    def test_gemini_general_exception_returns_500(self, client, mock_gemini, mock_env_with_key):
        """POST /api/v1/chat returns 500 for unexpected exceptions."""
        mock_gemini.interactions.create.side_effect = Exception("Unexpected error")

        response = client.post(
            "/api/v1/chat",
            json={"question": "What is SST?"},
        )

        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        # The error message should not expose internal details
        assert "Unexpected error" not in data["detail"]

    def test_missing_api_key_returns_500(self, client):
        """POST /api/v1/chat returns 500 when GEMINI_API_KEY is not set."""
        with patch.dict("os.environ", {}, clear=True):
            response = client.post(
                "/api/v1/chat",
                json={"question": "What is ocean salinity?"},
            )

            assert response.status_code == 500


# ---------------------------------------------------------------------------
# Test: API key security
# ---------------------------------------------------------------------------


class TestChatSecurity:
    def test_api_key_not_exposed_in_error_response(self, client):
        """Verify that the API key is never exposed in error responses."""
        with patch.dict("os.environ", {}, clear=True):
            response = client.post(
                "/api/v1/chat",
                json={"question": "What is SST?"},
            )

            assert response.status_code == 500
            response_text = response.text
            # The actual API key should never appear in any response
            assert "AIza" not in response_text  # Common Gemini key prefix

    def test_api_key_not_in_response_headers(self, client, mock_gemini, mock_env_with_key):
        """Verify that the API key is not in response headers."""
        response = client.post(
            "/api/v1/chat",
            json={"question": "What is ocean salinity?"},
        )

        # Check all headers for leaked key
        for header, value in response.headers.items():
            assert "AIza" not in str(value)
            assert "api_key" not in str(value).lower()
