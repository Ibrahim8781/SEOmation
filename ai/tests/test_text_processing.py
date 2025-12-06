import pytest
from utils.text_processing import chunk_text, clean_text

class TestTextProcessing:
    
    def test_chunk_text_basic(self):
        """Test basic text chunking"""
        text = "This is sentence one. This is sentence two. This is sentence three. " * 20  # Make it longer
        chunks = chunk_text(text, max_words=50)  # Correct parameter name
        
        assert len(chunks) > 0
        # Each chunk should have roughly max_words or less
        for chunk in chunks:
            assert len(chunk.split()) <= 50 * 1.2  # Allow some flexibility
    
    def test_chunk_text_empty_string(self):
        """Test chunking empty string"""
        chunks = chunk_text("", max_words=100)
        
        assert chunks == []
    
    def test_chunk_text_short_text(self):
        """Test chunking text shorter than minimum (30 words)"""
        text = "Short text with only a few words here."  # Less than 30 words
        chunks = chunk_text(text, max_words=100)
        
        # Should return empty list because text has < 30 words
        assert chunks == []
    
    def test_chunk_text_adequate_length(self):
        """Test chunking text with adequate length (>30 words)"""
        # Create text with exactly 100 words
        text = " ".join(["word"] * 100)
        chunks = chunk_text(text, max_words=50)
        
        # Should create at least 1 chunk
        assert len(chunks) >= 1
        # First chunk should have around 50 words
        assert 30 <= len(chunks[0].split()) <= 50
    
    def test_chunk_text_preserves_content(self):
        """Test that content words appear in chunks"""
        text = " ".join(["Important", "content", "word"] * 40)  # 120 words total
        chunks = chunk_text(text, max_words=50)
        
        assert len(chunks) > 0
        # Verify chunks contain the expected words
        all_chunk_text = " ".join(chunks)
        assert "Important" in all_chunk_text
        assert "content" in all_chunk_text
    
    def test_clean_text_removes_html(self):
        """Test that clean_text removes HTML tags"""
        html = "<p>This is <strong>bold</strong> text.</p>"
        cleaned = clean_text(html)
        
        assert "<p>" not in cleaned
        assert "<strong>" not in cleaned
        assert "This is bold text" in cleaned
    
    def test_clean_text_normalizes_whitespace(self):
        """Test that clean_text normalizes whitespace"""
        text = "This   has    multiple     spaces"
        cleaned = clean_text(text)
        
        assert "  " not in cleaned  # No double spaces
        assert cleaned == "This has multiple spaces"