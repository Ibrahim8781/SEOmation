import pytest
from services.rag_service import (
    stable_namespace,
    quick_seed_now,
    retrieve_context
)
from services.embedding_service import embed_texts

@pytest.mark.asyncio
class TestRagService:
    """Test suite for RAG service [TOPIC-002, TOPIC-003]"""
    
    def test_stable_namespace_generation(self):
        """Test namespace generation"""
        ns = stable_namespace("user123", "en", "saas")
        assert ns == "user123:en:saas"
    
    async def test_quick_seed(self):
        """Test quick seed functionality"""
        ns = "test:en:seo"
        await quick_seed_now(
            "test-user",
            "en",
            "SEO",
            "US",
            "Q4",
            ["keyword1", "keyword2"],
            ns
        )
        # Should complete without error
        assert True
    
    async def test_retrieve_context(self):
        """[TOPIC-002] Test RAG context retrieval"""
        ns = "test:en:marketing"
        await quick_seed_now("test-user", "en", "Marketing", None, None, ["SEO"], ns)
        
        context = await retrieve_context(
            "test-user",
            "en",
            "Marketing",
            {"role": "marketer", "pains": []},
            "content marketing",
            "SEO",
            True,
            ns
        )
        
        assert "snippets" in context
        assert "usedRAG" in context
    
    def test_embedding_service(self):
        """Test embedding generation"""
        texts = ["SEO optimization", "Content marketing"]
        embeddings = embed_texts(texts)
        
        assert len(embeddings) == 2
        assert len(embeddings[0]) > 0  # Should have dimensions
        assert all(isinstance(x, float) for x in embeddings[0])