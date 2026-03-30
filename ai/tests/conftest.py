"""
tests/conftest.py
Shared fixtures for the AI service test suite.

Requirements:
- The .env file in SEOmation/ai/ must have valid API keys for:
    GEMINI_API_KEY, GROQ_API_KEY (for integration tests)
    TOGETHER_API_KEY or other image providers (for image integration tests)
- VECTOR_BACKEND can be "memory" (default) for tests — no Qdrant required.

Run all:             pytest tests/ -v
Run unit tests only: pytest tests/ -m "not integration" -v
Run integration:     pytest tests/ -m integration -v --timeout=120
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add ai/ root to Python path so imports work from tests/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app


@pytest.fixture(scope="session")
def client():
    """
    FastAPI TestClient — wraps the app, no server process needed.
    Uses the same app instance for the entire test session.
    """
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(scope="session")
def blog_generate_payload():
    """Minimal valid payload for POST /content/generate (blog)."""
    return {
        "userId": "test-user-001",
        "platform": "blog",
        "language": "en",
        "topicOrIdea": "How to build a SaaS product from scratch",
        "focusKeyword": "SaaS product",
        "tone": "friendly",
        "targetLength": 800,
        "includeTrend": False,
        "styleGuideBullets": [],
        "niche": "SaaS technology",
        "seedKeywords": ["startup", "software"],
        "region": None,
        "season": None,
        "persona": {"role": "content creator", "pains": []},
        "namespace": None
    }


@pytest.fixture(scope="session")
def linkedin_generate_payload():
    """Minimal valid payload for POST /content/generate (linkedin)."""
    return {
        "userId": "test-user-001",
        "platform": "linkedin",
        "language": "en",
        "topicOrIdea": "Top productivity tips for remote teams",
        "focusKeyword": "remote productivity",
        "tone": "professional",
        "targetLength": 400,
        "includeTrend": False,
        "styleGuideBullets": [],
        "niche": "productivity",
        "seedKeywords": [],
        "region": None,
        "season": None,
        "persona": None,
        "namespace": None
    }


@pytest.fixture(scope="session")
def instagram_generate_payload():
    """Minimal valid payload for POST /content/generate (instagram)."""
    return {
        "userId": "test-user-001",
        "platform": "instagram",
        "language": "en",
        "topicOrIdea": "Morning routine for entrepreneurs",
        "focusKeyword": "morning routine",
        "tone": "casual",
        "targetLength": 180,
        "includeTrend": False,
        "styleGuideBullets": [],
        "niche": "lifestyle",
        "seedKeywords": [],
        "region": None,
        "season": None,
        "persona": None,
        "namespace": None
    }


@pytest.fixture(scope="session")
def topic_suggest_payload():
    """Minimal valid payload for POST /topic/suggest."""
    return {
        "userId": "test-user-001",
        "language": "en",
        "niche": "SaaS technology",
        "persona": {"role": "content creator", "pains": ["lack of time", "low traffic"]},
        "seedKeywords": ["startup", "software as a service"],
        "region": None,
        "season": None,
        "contentGoals": None,
        "preferredContentTypes": [],
        "count": 5,
        "includeTrends": False,
        "namespace": None
    }


@pytest.fixture(scope="session")
def image_generate_payload():
    """Minimal valid payload for POST /image/generate."""
    return {
        "prompt": "A professional SaaS dashboard interface with dark theme",
        "platform": "blog",
        "style": None,
        "sizes": ["512x512"],
        "count": 1,
        "language": "en"
    }
