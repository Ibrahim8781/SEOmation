import pytest
from unittest.mock import Mock
import sys
from pathlib import Path

# Add parent directory to path so tests can import services
sys.path.insert(0, str(Path(__file__).parent.parent))

@pytest.fixture
def mock_settings():
    """Mock settings for tests"""
    mock = Mock()
    mock.EMBEDDER = "sbert"
    mock.SBERT_MODEL = "all-MiniLM-L6-v2"
    mock.COHERE_API_KEY = "test-api-key"
    return mock