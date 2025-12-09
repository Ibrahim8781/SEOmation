import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestSeoHints:
    """Test suite for SEO hints [SEO-001 to SEO-007]"""
    
    async def test_seo_score_calculation(self, client: AsyncClient):
        """[SEO-001] Calculate SEO score"""
        request = {
            "platform": "blog",
            "language": "en",
            "focusKeyword": "SEO tips",
            "content": "<h1>SEO tips for beginners</h1><h2>Introduction</h2><p>SEO tips are essential for improving your website's visibility. This comprehensive guide covers keyword research, on-page optimization, and link building strategies.</p>"
        }
        
        response = await client.post("/seo/hints", json=request)
        assert response.status_code == 200
        
        data = response.json()
        assert "score" in data
        assert "hints" in data
        assert 0 <= data["score"] <= 100
    
    async def test_seo_missing_h1_detection(self, client: AsyncClient):
        """[SEO-002] Detect missing H1"""
        request = {
            "platform": "blog",
            "language": "en",
            "focusKeyword": "test",
            "content": "<p>Content without H1 tag</p>"
        }
        
        response = await client.post("/seo/hints", json=request)
        data = response.json()
        
        # Should have hints about structure
        assert data["score"] < 100
        assert len(data["hints"]) > 0
    
    async def test_seo_keyword_density(self, client: AsyncClient):
        """[SEO-003] Keyword density calculation"""
        content = "<h1>SEO Guide</h1>" + "<p>SEO is important. SEO helps visibility.</p>" * 50
        request = {
            "platform": "blog",
            "language": "en",
            "focusKeyword": "SEO",
            "content": content
        }
        
        response = await client.post("/seo/hints", json=request)
        assert response.status_code == 200