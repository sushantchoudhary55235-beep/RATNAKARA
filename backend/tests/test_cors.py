"""Tests for CORS configuration."""

from fastapi.testclient import TestClient


class TestCORS:
    def test_cors_allows_localhost_5173(self, client: TestClient) -> None:
        """Vite dev server origin should be allowed."""
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        # CORS middleware should respond with 200/204 and the allowed origin
        assert resp.status_code in (200, 204)
        assert "access-control-allow-origin" in resp.headers

    def test_cors_allows_localhost_3000(self, client: TestClient) -> None:
        """CRA dev server origin should be allowed."""
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code in (200, 204)
        assert "access-control-allow-origin" in resp.headers

    def test_cors_headers_on_get(self, client: TestClient) -> None:
        """GET requests should include CORS headers."""
        resp = client.get(
            "/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert resp.status_code == 200
        # FastAPI CORS middleware adds these headers
        assert "access-control-allow-origin" in resp.headers
