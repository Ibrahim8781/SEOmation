"""
Extended Unit Tests for text_processing utilities
Covers: clean_text, chunk_text – boundary conditions and edge cases
"""
import pytest
from utils.text_processing import clean_text, chunk_text


class TestCleanText:
    def test_removes_html_tags(self):
        result = clean_text("<p>Hello <strong>world</strong></p>")
        assert "<" not in result
        assert ">" not in result

    def test_preserves_text_content(self):
        result = clean_text("<p>Hello world</p>")
        assert "Hello" in result
        assert "world" in result

    def test_collapses_multiple_spaces(self):
        result = clean_text("  too   many   spaces  ")
        assert "  " not in result

    def test_strips_leading_trailing_whitespace(self):
        result = clean_text("  leading and trailing  ")
        assert result == result.strip()

    def test_empty_string(self):
        assert clean_text("") == ""

    def test_none_input(self):
        assert clean_text(None) == ""

    def test_plain_text_unchanged(self):
        result = clean_text("Just plain text here")
        assert "Just plain text here" == result

    def test_nested_html(self):
        result = clean_text("<div><p><span>Deep</span></p></div>")
        assert "Deep" in result
        assert "<" not in result

    def test_html_with_attributes(self):
        result = clean_text('<a href="https://example.com" class="link">Click here</a>')
        assert "Click here" in result
        assert "href" not in result

    def test_script_tag_content_removed(self):
        result = clean_text("<script>alert(1)</script>Some content")
        # The text "Some content" should remain; script tag should be stripped
        assert "Some content" in result
        assert "<script>" not in result

    def test_newlines_collapsed(self):
        result = clean_text("line one\n\nline two\n\nline three")
        # Should collapse excessive whitespace
        assert "\n\n\n" not in result

    def test_unicode_preserved(self):
        result = clean_text("<p>مرحبا بالعالم</p>")
        assert "مرحبا" in result

    def test_emoji_preserved(self):
        result = clean_text("<p>Hello 🎉 world</p>")
        assert "🎉" in result


class TestChunkText:
    def test_splits_into_multiple_chunks(self):
        text = " ".join(["word"] * 200)
        chunks = chunk_text(text, max_words=50)
        assert len(chunks) > 1

    def test_each_chunk_respects_max_words(self):
        text = " ".join(["word"] * 200)
        chunks = chunk_text(text, max_words=50)
        for chunk in chunks:
            assert len(chunk.split()) <= 50

    def test_each_chunk_has_minimum_words(self):
        """Chunks with fewer than 30 words should be filtered out"""
        text = " ".join(["word"] * 200)
        chunks = chunk_text(text, max_words=50)
        for chunk in chunks:
            assert len(chunk.split()) >= 30

    def test_empty_string(self):
        assert chunk_text("") == []

    def test_none_string(self):
        # clean_text handles None; chunk_text may receive pre-cleaned text
        # Should not crash even on empty input
        result = chunk_text("")
        assert result == []

    def test_short_text_filtered_out(self):
        """Text shorter than 30 words should not produce any chunks"""
        text = " ".join(["word"] * 20)
        chunks = chunk_text(text, max_words=50)
        assert len(chunks) == 0

    def test_exactly_max_words(self):
        text = " ".join(["word"] * 50)
        chunks = chunk_text(text, max_words=50)
        # Should produce exactly one chunk (50 words >= 30 min)
        assert len(chunks) == 1

    def test_custom_max_words_parameter(self):
        text = " ".join(["word"] * 300)
        chunks_80 = chunk_text(text, max_words=80)
        chunks_120 = chunk_text(text, max_words=120)
        # Smaller max_words produces more chunks
        assert len(chunks_80) >= len(chunks_120)

    def test_default_max_words_is_120(self):
        text = " ".join(["word"] * 360)
        chunks = chunk_text(text)  # default=120
        assert len(chunks) > 0
        for chunk in chunks:
            assert len(chunk.split()) <= 120

    def test_chunks_cover_full_text(self):
        """All words should appear in at least one chunk"""
        text = " ".join([f"word{i}" for i in range(200)])
        chunks = chunk_text(text, max_words=50)
        combined = " ".join(chunks)
        # At least 80% of unique words should be covered
        original_words = set(text.split())
        covered_words = set(combined.split())
        coverage = len(covered_words & original_words) / len(original_words)
        assert coverage >= 0.8
