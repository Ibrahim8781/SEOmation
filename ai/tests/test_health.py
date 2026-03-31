"""
tests/test_health.py
GET /health — basic service availability check.
"""

import pytest


@pytest.mark.unit
def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


@pytest.mark.unit
def test_health_returns_ok_true(client):
    response = client.get("/health")
    body = response.json()
    assert body.get("ok") is True


@pytest.mark.unit
def test_app_has_correct_title(client):
    """Verify FastAPI app metadata is set correctly."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert "SEOmation" in spec.get("info", {}).get("title", "")


@pytest.mark.unit
def test_app_version_is_set(client):
    response = client.get("/openapi.json")
    spec = response.json()
    version = spec.get("info", {}).get("version", "")
    assert len(version) > 0
