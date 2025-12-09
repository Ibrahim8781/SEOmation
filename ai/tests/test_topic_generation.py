import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestTopicGeneration:
    """Test suite for topic generation [TOPIC-001 to TOPIC-007]"""
    
    async def test_generate_topics_valid_niche(self, client: AsyncClient, sample_topic_request):
        """[TOPIC-001] Generate topics with valid niche"""
        response = await client.post("/topic/suggest", json=sample_topic_request)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "ideas" in data
        assert "clusters" in data
        assert "diagnostics" in data
        
        ideas = data["ideas"]
        assert isinstance(ideas, list)
        assert len(ideas) > 0
        assert len(ideas) <= sample_topic_request["count"]
        
        # Validate idea structure
        for idea in ideas:
            assert "ideaText" in idea
            assert "targetKeyword" in idea
            assert "language" in idea
            assert len(idea["ideaText"]) >= 20
            assert len(idea["ideaText"]) <= 120
    
    async def test_topics_no_duplicates(self, client: AsyncClient, sample_topic_request):
        """[TOPIC-007] Ensure no duplicate topics"""
        response = await client.post("/topic/suggest", json=sample_topic_request)
        data = response.json()
        
        titles = [idea["ideaText"] for idea in data["ideas"]]
        assert len(titles) == len(set(titles)), "Duplicate topics found"
    
    async def test_topics_language_support(self, client: AsyncClient, sample_topic_request):
        """[TOPIC-006] Test German language support"""
        request = {**sample_topic_request, "language": "de"}
        response = await client.post("/topic/suggest", json=request)
        
        assert response.status_code == 200
        data = response.json()
        assert data["ideas"][0]["language"] == "de"
    
    async def test_topics_clustering(self, client: AsyncClient, sample_topic_request):
        """[TOPIC-004] Verify topic clustering"""
        response = await client.post("/topic/suggest", json=sample_topic_request)
        data = response.json()
        
        clusters = data.get("clusters", [])
        if clusters:
            assert len(clusters) >= 3
            assert len(clusters) <= 5
            for cluster in clusters:
                assert "label" in cluster
                assert "ideas" in cluster
    
    async def test_topics_empty_niche_fallback(self, client: AsyncClient, sample_topic_request):
        """[TOPIC-005] Handle empty/invalid niche gracefully"""
        request = {**sample_topic_request, "niche": "", "seedKeywords": []}
        response = await client.post("/topic/suggest", json=request)
        
        # Should still return topics (seed-based)
        assert response.status_code == 200
        data = response.json()
        assert len(data["ideas"]) > 0