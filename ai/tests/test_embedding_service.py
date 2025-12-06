import pytest
from unittest.mock import Mock, patch, MagicMock
from services.embedding_service import embed_texts, _embed_cohere, _embed_sbert

class TestEmbeddingService:
    
    @patch('services.embedding_service.settings')
    @patch('services.embedding_service._embed_sbert')
    def test_embed_texts_uses_sbert(self, mock_sbert, mock_settings):
        """Test that embed_texts uses SBERT when configured"""
        mock_settings.EMBEDDER = "sbert"
        texts = ["test text 1", "test text 2"]
        expected = [[0.1, 0.2], [0.3, 0.4]]
        mock_sbert.return_value = expected
        
        result = embed_texts(texts)
        
        mock_sbert.assert_called_once_with(texts)
        assert result == expected
    
    @patch('services.embedding_service.settings')
    @patch('services.embedding_service._embed_cohere')
    def test_embed_texts_uses_cohere_by_default(self, mock_cohere, mock_settings):
        """Test that embed_texts uses Cohere by default"""
        mock_settings.EMBEDDER = "cohere"
        texts = ["test text"]
        expected = [[0.5, 0.6]]
        mock_cohere.return_value = expected
        
        result = embed_texts(texts)
        
        mock_cohere.assert_called_once_with(texts)
        assert result == expected
    
    @patch('cohere.Client')
    @patch('services.embedding_service.settings')
    def test_embed_cohere_success(self, mock_settings, mock_client_class):
        """Test successful Cohere embedding"""
        mock_settings.COHERE_API_KEY = "test-api-key"
        
        mock_response = Mock()
        mock_response.embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        
        mock_client = Mock()
        mock_client.embed.return_value = mock_response
        mock_client_class.return_value = mock_client
        
        texts = ["hello world", "test text"]
        result = _embed_cohere(texts)
        
        mock_client_class.assert_called_once_with(api_key="test-api-key")
        mock_client.embed.assert_called_once_with(
            texts=texts,
            model="embed-multilingual-v3.0",
            input_type="search_document"
        )
        assert result == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    
    @patch('sentence_transformers.SentenceTransformer')
    @patch('services.embedding_service.settings')
    def test_embed_sbert_success(self, mock_settings, mock_model_class):
        """Test successful SBERT embedding"""
        mock_settings.SBERT_MODEL = "all-MiniLM-L6-v2"
        
        import numpy as np
        mock_embeddings = np.array([[0.1, 0.2], [0.3, 0.4]])
        
        mock_model = Mock()
        mock_model.encode.return_value = mock_embeddings
        mock_model_class.return_value = mock_model
        
        texts = ["text 1", "text 2"]
        result = _embed_sbert(texts)
        
        mock_model_class.assert_called_once_with("all-MiniLM-L6-v2")
        mock_model.encode.assert_called_once_with(
            texts,
            show_progress_bar=False,
            convert_to_numpy=False,
            normalize_embeddings=True
        )
        assert len(result) == 2
        assert all(isinstance(emb, list) for emb in result)
    
    @patch('cohere.Client')
    @patch('services.embedding_service.settings')
    def test_embed_cohere_handles_error(self, mock_settings, mock_client_class):
        """Test Cohere embedding handles API errors"""
        mock_settings.COHERE_API_KEY = "test-api-key"
        
        mock_client = Mock()
        mock_client.embed.side_effect = Exception("API Error")
        mock_client_class.return_value = mock_client
        
        texts = ["test"]
        
        with pytest.raises(Exception, match="API Error"):
            _embed_cohere(texts)