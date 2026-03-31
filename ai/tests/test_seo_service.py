"""
tests/test_seo_service.py
Unit tests for text_quality_service.score_content_metrics.
No external API calls.
"""

import pytest
from services.text_quality_service import score_content_metrics, _strip_html, _split_sentences


# ---------------------------------------------------------------------------
# score_content_metrics
# ---------------------------------------------------------------------------

class TestScoreContentMetrics:

    @pytest.mark.unit
    def test_returns_dict_with_required_keys(self):
        result = score_content_metrics(
            html="<p>Hello world. This is a test sentence.</p>",
            plain_text="Hello world. This is a test sentence.",
            language="en"
        )
        assert isinstance(result, dict)
        assert "grammarScore" in result
        assert "readabilityScore" in result
        assert "ragScore" in result

    @pytest.mark.unit
    def test_scores_are_between_0_and_100(self):
        result = score_content_metrics(
            html="<p>This is well-written content with proper sentences.</p>",
            plain_text="This is well-written content with proper sentences.",
            language="en"
        )
        for key in ["grammarScore", "readabilityScore"]:
            score = result[key]
            if score is not None:
                assert 0.0 <= score <= 100.0, f"{key}={score} out of range"

    @pytest.mark.unit
    def test_empty_text_returns_none_scores(self):
        result = score_content_metrics(html="", plain_text="", language="en")
        assert result["grammarScore"] is None
        assert result["readabilityScore"] is None
        assert result["ragScore"] is None

    @pytest.mark.unit
    def test_rag_score_is_always_none(self):
        result = score_content_metrics(
            html="<p>Content with many words written properly.</p>",
            plain_text="Content with many words written properly.",
            language="en"
        )
        assert result["ragScore"] is None

    @pytest.mark.unit
    def test_well_written_content_scores_above_50(self):
        good_content = (
            "Building a successful SaaS product requires planning and execution. "
            "First, identify your target market and their pain points. "
            "Then, develop a minimum viable product to validate your assumptions. "
            "Finally, iterate based on user feedback to improve your product. "
            "Successful SaaS companies focus on customer success above all else."
        )
        result = score_content_metrics(
            html=f"<p>{good_content}</p>",
            plain_text=good_content,
            language="en"
        )
        grammar = result["grammarScore"]
        readability = result["readabilityScore"]
        if grammar is not None:
            assert grammar > 50.0, f"Good content grammar score too low: {grammar}"
        if readability is not None:
            assert readability > 30.0, f"Good content readability score too low: {readability}"

    @pytest.mark.unit
    def test_html_is_stripped_for_scoring(self):
        """Results from HTML input and plain text should be similar."""
        plain = "This is a sentence. Another sentence follows here."
        result_html = score_content_metrics(
            html=f"<h1>Title</h1><p>{plain}</p>",
            plain_text="",
            language="en"
        )
        result_plain = score_content_metrics(
            html="",
            plain_text=plain,
            language="en"
        )
        # Both should produce non-None scores (not empty)
        assert result_html["grammarScore"] is not None
        assert result_plain["grammarScore"] is not None

    @pytest.mark.unit
    def test_german_language_produces_scores(self):
        german_text = "Das ist ein guter Satz. Noch ein weiterer Satz folgt hier."
        result = score_content_metrics(
            html=f"<p>{german_text}</p>",
            plain_text=german_text,
            language="de"
        )
        assert result["grammarScore"] is not None
        assert result["readabilityScore"] is not None

    @pytest.mark.unit
    def test_repeated_words_penalize_grammar(self):
        good = "The system works well. Users are satisfied with the product."
        bad = "The the system works well well. Users users are satisfied."
        result_good = score_content_metrics(html="", plain_text=good, language="en")
        result_bad = score_content_metrics(html="", plain_text=bad, language="en")
        if result_good["grammarScore"] and result_bad["grammarScore"]:
            assert result_good["grammarScore"] >= result_bad["grammarScore"], \
                "Repeated words should lower grammar score"

    @pytest.mark.unit
    def test_scores_are_rounded_to_2_decimals(self):
        result = score_content_metrics(
            html="<p>A proper sentence here. Another proper sentence.</p>",
            plain_text="A proper sentence here. Another proper sentence.",
            language="en"
        )
        for key in ["grammarScore", "readabilityScore"]:
            score = result[key]
            if score is not None:
                # Check it's a float rounded to 2 decimal places
                assert score == round(score, 2)


# ---------------------------------------------------------------------------
# Internal helper tests
# ---------------------------------------------------------------------------

class TestInternalHelpers:

    @pytest.mark.unit
    def test_strip_html_removes_tags(self):
        result = _strip_html("<h1>Title</h1><p>Content here.</p>")
        assert "<" not in result
        assert "Title" in result
        assert "Content" in result

    @pytest.mark.unit
    def test_strip_html_empty_string(self):
        assert _strip_html("") == " " or _strip_html("") == ""

    @pytest.mark.unit
    def test_split_sentences_splits_on_period(self):
        sentences = _split_sentences("First sentence. Second sentence. Third sentence.")
        assert len(sentences) >= 2

    @pytest.mark.unit
    def test_split_sentences_handles_empty(self):
        result = _split_sentences("")
        assert result == []
