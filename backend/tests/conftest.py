"""Shared pytest fixtures for the backend test suite."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """TestClient for the SAGARA FastAPI application."""
    return TestClient(app)