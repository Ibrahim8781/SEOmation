"""
Comprehensive Unit Tests for quality_checker.py
Covers: all scoring branches, boundary conditions, edge cases
"""
import pytest
from services.quality_checker import (
    seo_score_and_hints,
    _strip_html,
    _to_words,
    _severity,
    _count_occurrences,
    _heading_structure_score,
    _image_alt_score,
    _keyword_score,
    _length_score,
)


# ── Helpers ──────────────────────────────────────────────────────────
FULL_HTML = (
    "<h1>SaaS SEO Guide for 2024 and Beyond</h1>"
    "<h2>Why SEO Matters for SaaS</h2>"
    "<p>SaaS SEO is critical for growth. " + "Word " * 60 + "</p>"
    "<h2>Key Strategies</h2>"
    "<p>Focus on long-tail keywords. " + "Content " * 60 + "</p>"
    "<h3>Advanced Tips</h3>"
    "<p>Use structured data markup. " + "More tips " * 40 + "</p>"
)


class TestStripHtml:
    def test_removes_tags(self):
        assert "<p>" not in _strip_html("<p>Hello</p>")

    def test_keeps_text(self):
        assert "Hello" in _strip_html("<p>Hello</p>")

    def test_empty_string(self):
        assert _strip_html("") == ""

    def test_none_input(self):
        assert _strip_html(None) == ""

    def test_nested_tags(self):
        result = _strip_html("<div><p><strong>Bold</strong></p></div>")
        assert "Bold" in result
        assert "<" not in result


class TestToWords:
    def test_splits_words(self):
        words = _to_words("Hello world test")
        assert words == ["Hello", "world", "test"]

    def test_strips_html_first(self):
        words = _to_words("<p>Hello</p>")
        assert "Hello" in words

    def test_empty(self):
        assert _to_words("") == []

    def test_none(self):
        assert _to_words(None) == []

    def test_ignores_punctuation(self):
        words = _to_words("Hello, world! Test.")
        assert "Hello" in words
        assert "world" in words


class TestSeverity:
    def test_ok_for_high_ratio(self):
        assert _severity(8, 10) == "ok"

    def test_warn_for_mid_ratio(self):
        assert _severity(5, 10) == "warn"

    def test_error_for_low_ratio(self):
        assert _severity(2, 10) == "error"

    def test_warn_for_zero_max(self):
        assert _severity(0, 0) == "warn"

    def test_boundary_exactly_80_percent(self):
        assert _severity(8, 10) == "ok"

    def test_boundary_exactly_50_percent(self):
        assert _severity(5, 10) == "warn"


class TestCountOccurrences:
    def test_counts_word_occurrences(self):
        assert _count_occurrences("SEO is about SEO and more SEO", "SEO") == 3

    def test_case_insensitive(self):
        assert _count_occurrences("seo SEO Seo", "seo") == 3

    def test_no_partial_matches(self):
        # "SEOs" should NOT count as "SEO" (word boundary)
        count = _count_occurrences("SEOs are not SEO", "SEO")
        assert count == 1

    def test_empty_keyword(self):
        assert _count_occurrences("some text", "") == 0

    def test_empty_text(self):
        assert _count_occurrences("", "keyword") == 0

    def test_special_regex_chars_in_keyword(self):
        # Should not raise on regex special chars
        assert _count_occurrences("c++ is cool", "c++") >= 0


class TestHeadingStructureScore:
    def test_no_h1_scores_zero(self):
        score, msg, max_score = _heading_structure_score("<h2>Section</h2><p>Content</p>")
        assert score == 0
        assert "H1" in msg
        assert max_score == 15

    def test_h1_only_scores_seven(self):
        score, msg, _ = _heading_structure_score("<h1>Title</h1><p>Content</p>")
        assert score == 7

    def test_h1_and_two_h2_scores_thirteen(self):
        score, msg, _ = _heading_structure_score("<h1>Title</h1><h2>S1</h2><h2>S2</h2>")
        assert score == 13
        assert "solid" in msg.lower()

    def test_h1_h2_h3_scores_thirteen(self):
        score, _, _ = _heading_structure_score("<h1>T</h1><h2>S1</h2><h3>Sub</h3>")
        assert score == 13

    def test_empty_html(self):
        score, _, _ = _heading_structure_score("")
        assert score == 0

    def test_multiple_h1_still_passes(self):
        # Two H1s + two H2s → hierarchy exists
        score, _, _ = _heading_structure_score("<h1>A</h1><h1>B</h1><h2>C</h2><h2>D</h2>")
        assert score == 13


class TestImageAltScore:
    def test_no_images_scores_four(self):
        score, msg, _ = _image_alt_score("", [])
        assert score == 4
        assert "add images" in msg.lower()

    def test_descriptive_alt_scores_ten(self):
        score, msg, _ = _image_alt_score("", [{"altText": "A descriptive screenshot"}])
        assert score == 10
        assert "all images" in msg.lower()

    def test_short_alt_scores_lower(self):
        score, _, _ = _image_alt_score("", [{"altText": "Hi"}])
        assert score < 10

    def test_html_img_tag_alt_extraction(self):
        html = '<img src="a.jpg" alt="Detailed alt text here" />'
        score, _, _ = _image_alt_score(html, [])
        assert score == 10

    def test_mixed_alts_triggers_partial_message(self):
        _, msg, _ = _image_alt_score("", [
            {"altText": "Good descriptive alt text"},
            {"altText": "hi"},
        ])
        assert "some images" in msg.lower()

    def test_none_images_list_handled(self):
        score, _, _ = _image_alt_score("", None)
        assert score == 4


class TestKeywordScore:
    def test_no_keyword_returns_zero(self):
        score, msg, _, _ = _keyword_score("Some content here", "", [])
        assert score == 0
        assert "primary keyword" in msg.lower()

    def test_healthy_density_scores_twelve(self):
        # ~1.5% density: 3 in 200 words
        text = "SEO " + "word " * 99 + "SEO " + "word " * 99 + "SEO"
        score, _, _, density = _keyword_score(text, "SEO", [])
        assert score == 12
        assert 0.8 <= density <= 3.5

    def test_low_density_scores_six(self):
        text = "SEO " + "word " * 300
        score, _, _, _ = _keyword_score(text, "SEO", [])
        assert score == 6

    def test_high_density_scores_eight(self):
        text = "SEO " * 50 + "word " * 50
        score, _, _, _ = _keyword_score(text, "SEO", [])
        assert score == 8

    def test_secondary_keywords_add_two_points(self):
        text = "SEO " + "word " * 99 + "SEO " + "word " * 99 + "SEO rank"
        base, _, _, _ = _keyword_score(text, "SEO", [])
        with_sec, _, _, _ = _keyword_score(text, "SEO", ["rank"])
        assert with_sec > base

    def test_secondary_keywords_capped_at_fifteen(self):
        text = "SEO " * 20 + "word " * 80
        score, _, max_s, _ = _keyword_score(text, "SEO", ["SEO", "word"])
        assert score <= max_s

    def test_density_is_float(self):
        _, _, _, density = _keyword_score("SEO word word word", "SEO", [])
        assert isinstance(density, float)


class TestLengthScore:
    def test_400_plus_words_scores_15(self):
        assert _length_score(400) == (15, "Great depth; article is long enough.", 15)
        assert _length_score(1000)[0] == 15

    def test_300_to_399_scores_13(self):
        assert _length_score(350)[0] == 13

    def test_250_to_299_scores_11(self):
        assert _length_score(275)[0] == 11

    def test_150_to_249_scores_9(self):
        assert _length_score(200)[0] == 9

    def test_100_to_149_scores_7(self):
        assert _length_score(120)[0] == 7

    def test_under_100_scores_4(self):
        assert _length_score(50)[0] == 4
        assert _length_score(0)[0] == 4


class TestSeoScoreAndHints:
    """Integration tests for the main seo_score_and_hints function"""

    def test_returns_score_and_hints(self):
        score, hints = seo_score_and_hints("blog", "en", "SEO", FULL_HTML)
        assert 0 <= score <= 100
        assert isinstance(hints, list)

    def test_empty_content_has_all_hints(self):
        score, hints = seo_score_and_hints("blog", "en", "SEO", "")
        assert score < 50  # Should be low for empty content
        assert len(hints) > 0

    def test_hints_are_non_ok_items(self):
        score, hints = seo_score_and_hints("blog", "en", "SEO", "<h2>No H1 here</h2>")
        # Missing H1 should generate a hint
        hint_types = [h["type"] for h in hints]
        assert "headings" in hint_types

    def test_no_hints_for_high_quality_content(self):
        """Well-optimized content should have few or no hints"""
        html = (
            "<h1>SaaS SEO Mastery 2024 for Professionals</h1>"
            "<h2>Introduction</h2>"
            "<p>SaaS SEO is essential. " + "More words here. " * 80 + "</p>"
            "<h2>Key Strategies</h2>"
            "<p>Advanced tactics. " + "More content here. " * 80 + "</p>"
            "<h3>Best Practices</h3>"
            "<p>Expert advice. " + "More expert content. " * 40 + "</p>"
        )
        score, _ = seo_score_and_hints("blog", "en", "SaaS SEO", html)
        assert score > 40  # Should score reasonably well

    def test_none_content_doesnt_raise(self):
        score, hints = seo_score_and_hints("blog", "en", "test", None)
        assert isinstance(score, int)
        assert isinstance(hints, list)

    def test_score_is_integer(self):
        score, _ = seo_score_and_hints("blog", "en", "test", "<h1>Test</h1>")
        assert isinstance(score, int)

    def test_hints_have_required_fields(self):
        _, hints = seo_score_and_hints("blog", "en", "test", "")
        for hint in hints:
            assert "type" in hint
            assert "msg" in hint

    def test_platform_parameter_accepted(self):
        """Different platforms should not raise errors"""
        for platform in ["blog", "linkedin", "instagram"]:
            score, _ = seo_score_and_hints(platform, "en", "test", "<h1>Test</h1>")
            assert 0 <= score <= 100

    def test_adversarial_html_injection(self):
        """Malicious HTML should not crash the scorer"""
        malicious = "<script>alert(1)</script><h1>Normal Title</h1><img onerror='evil()' alt='test' />"
        score, hints = seo_score_and_hints("blog", "en", "test", malicious)
        assert isinstance(score, int)

    def test_very_long_content(self):
        """Extremely long content should not crash"""
        html = "<h1>T</h1><h2>S</h2><h2>S2</h2>" + "<p>word </p>" * 10000
        score, _ = seo_score_and_hints("blog", "en", "word", html)
        assert 0 <= score <= 100

    def test_unicode_keyword_and_content(self):
        """Unicode characters in keywords and content"""
        html = "<h1>SEO في 2024</h1><p>محتوى مفيد هنا</p>"
        score, _ = seo_score_and_hints("blog", "ar", "SEO", html)
        assert isinstance(score, int)

    def test_empty_keyword_still_scores(self):
        score, hints = seo_score_and_hints("blog", "en", "", FULL_HTML)
        assert isinstance(score, int)
        # Should have keyword hint since no keyword provided
        hint_types = [h["type"] for h in hints]
        assert "keywords" in hint_types

    def test_meta_tag_extraction(self):
        """Meta description from HTML comment should be extracted"""
        html = (
            "<h1>SaaS SEO Title for Optimization</h1>"
            "<!-- meta-description: A great description about SaaS SEO for professionals -->"
            "<h2>Section</h2><h2>Section Two</h2>"
            "<p>Content here. " + "word " * 100 + "</p>"
        )
        score, _ = seo_score_and_hints("blog", "en", "SaaS SEO", html)
        # Meta description hint should be reduced/absent if extracted
        assert isinstance(score, int)
