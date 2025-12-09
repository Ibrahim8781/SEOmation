import pytest
import asyncio
from httpx import AsyncClient
from main import app

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def client():
    """HTTP client for testing FastAPI app"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def sample_topic_request():
    """Sample topic generation request"""
    return {
        "userId": "test-user-123",
        "language": "en",
        "niche": "SaaS SEO",
        "persona": {"role": "founder", "pains": ["low traffic", "poor rankings"]},
        "seedKeywords": ["SEO", "content", "automation"],
        "region": "US",
        "season": "Q4",
        "count": 12,
        "includeTrends": True
    }

@pytest.fixture
def sample_content_request():
    """Sample content generation request"""
    return {
        "userId": "test-user-123",
        "platform": "blog",
        "language": "en",
        "topicOrIdea": "How to optimize SaaS landing pages",
        "tone": "friendly",
        "targetLength": 1200,
        "focusKeyword": "SaaS SEO",
        "includeTrend": True,
        "styleGuideBullets": ["Use simple language", "Include examples"]
    }