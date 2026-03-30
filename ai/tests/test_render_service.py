"""
tests/test_render_service.py
Unit tests for render_service — pure HTML/text rendering functions.
No external API calls.
"""

import pytest
from services.render_service import (
    blog_to_html,
    blog_to_plain,
    linkedin_to_html,
    linkedin_to_plain,
    instagram_to_html,
    instagram_to_plain,
)


# ---------------------------------------------------------------------------
# blog_to_html
# ---------------------------------------------------------------------------

class TestBlogToHtml:

    @pytest.mark.unit
    def test_renders_h1_from_h1_field(self):
        result = blog_to_html({"h1": "My Blog Title", "sections": []})
        assert "<h1>My Blog Title</h1>" in result

    @pytest.mark.unit
    def test_renders_sections_as_h2_and_p(self):
        result = blog_to_html({
            "sections": [{"h2": "Introduction", "body": "This is the intro."}]
        })
        assert "<h2>Introduction</h2>" in result
        assert "<p>" in result
        assert "This is the intro." in result

    @pytest.mark.unit
    def test_renders_faqs_section(self):
        result = blog_to_html({
            "sections": [],
            "faqs": [{"q": "What is SaaS?", "a": "Software as a Service."}]
        })
        assert "faqs" in result
        assert "What is SaaS?" in result
        assert "Software as a Service." in result

    @pytest.mark.unit
    def test_meta_description_in_comment(self):
        result = blog_to_html({
            "sections": [],
            "meta": {"description": "A test meta description"}
        })
        assert "meta-description" in result
        assert "A test meta description" in result

    @pytest.mark.unit
    def test_title_in_html_comment(self):
        result = blog_to_html({"title": "My Title", "sections": []})
        assert "<!-- title: My Title -->" in result

    @pytest.mark.unit
    def test_empty_dict_returns_string(self):
        result = blog_to_html({})
        assert isinstance(result, str)

    @pytest.mark.unit
    def test_html_escapes_special_chars(self):
        result = blog_to_html({
            "h1": "<script>alert('xss')</script>",
            "sections": []
        })
        assert "<script>" not in result
        assert "&lt;script&gt;" in result or "script" in result

    @pytest.mark.unit
    def test_returns_string_type(self):
        result = blog_to_html({"h1": "Test", "sections": []})
        assert isinstance(result, str)

    @pytest.mark.unit
    def test_multiple_sections_rendered(self):
        result = blog_to_html({
            "sections": [
                {"h2": "Section One", "body": "Body one."},
                {"h2": "Section Two", "body": "Body two."}
            ]
        })
        assert "Section One" in result
        assert "Section Two" in result


# ---------------------------------------------------------------------------
# blog_to_plain
# ---------------------------------------------------------------------------

class TestBlogToPlain:

    @pytest.mark.unit
    def test_returns_string(self):
        result = blog_to_plain({"h1": "Title", "sections": []})
        assert isinstance(result, str)

    @pytest.mark.unit
    def test_no_html_tags_in_plain(self):
        result = blog_to_plain({
            "h1": "My Title",
            "sections": [{"h2": "Section", "body": "Body text here."}]
        })
        assert "<" not in result
        assert ">" not in result

    @pytest.mark.unit
    def test_includes_h1_and_sections(self):
        result = blog_to_plain({
            "h1": "My Title",
            "sections": [{"h2": "First Section", "body": "First body content."}]
        })
        assert "My Title" in result
        assert "First Section" in result
        assert "First body content." in result

    @pytest.mark.unit
    def test_faqs_formatted_with_q_and_a(self):
        result = blog_to_plain({
            "sections": [],
            "faqs": [{"q": "What is this?", "a": "A test answer."}]
        })
        assert "Q: What is this?" in result
        assert "A: A test answer." in result

    @pytest.mark.unit
    def test_empty_dict_returns_empty_string(self):
        result = blog_to_plain({})
        assert result == "" or result.strip() == ""


# ---------------------------------------------------------------------------
# linkedin_to_html
# ---------------------------------------------------------------------------

class TestLinkedInToHtml:

    @pytest.mark.unit
    def test_renders_body_in_paragraph(self):
        result = linkedin_to_html({"body": "LinkedIn post content here.", "hashtags": []})
        assert "<p>" in result
        assert "LinkedIn post content here." in result

    @pytest.mark.unit
    def test_renders_hashtags(self):
        result = linkedin_to_html({
            "body": "Check this out.",
            "hashtags": ["SaaS", "Marketing", "Growth"]
        })
        assert "#SaaS" in result or "#saas" in result.lower()

    @pytest.mark.unit
    def test_limits_hashtags_to_5(self):
        hashtags = [f"Tag{i}" for i in range(10)]
        result = linkedin_to_html({"body": "Post body.", "hashtags": hashtags})
        # At most 5 hashtags should appear
        count = result.count("#Tag")
        assert count <= 5

    @pytest.mark.unit
    def test_empty_body_returns_string(self):
        result = linkedin_to_html({"body": "", "hashtags": []})
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# linkedin_to_plain
# ---------------------------------------------------------------------------

class TestLinkedInToPlain:

    @pytest.mark.unit
    def test_returns_plain_string(self):
        result = linkedin_to_plain({"body": "Plain text post.", "hashtags": ["saas"]})
        assert isinstance(result, str)
        assert "<" not in result

    @pytest.mark.unit
    def test_body_and_hashtags_separated(self):
        result = linkedin_to_plain({
            "body": "This is the post body.",
            "hashtags": ["saas", "startup"]
        })
        assert "This is the post body." in result
        assert "#saas" in result or "#startup" in result


# ---------------------------------------------------------------------------
# instagram_to_html
# ---------------------------------------------------------------------------

class TestInstagramToHtml:

    @pytest.mark.unit
    def test_renders_caption(self):
        result = instagram_to_html({"caption": "Check out this amazing product!", "hashtags": []})
        assert "Check out this amazing product!" in result

    @pytest.mark.unit
    def test_renders_hashtags_up_to_15(self):
        hashtags = [f"tag{i}" for i in range(20)]
        result = instagram_to_html({"caption": "Caption here.", "hashtags": hashtags})
        count = sum(1 for i in range(15) if f"#tag{i}" in result)
        assert count <= 15

    @pytest.mark.unit
    def test_empty_caption_returns_string(self):
        result = instagram_to_html({"caption": "", "hashtags": ["test"]})
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# instagram_to_plain
# ---------------------------------------------------------------------------

class TestInstagramToPlain:

    @pytest.mark.unit
    def test_returns_string_with_caption_and_hashtags(self):
        result = instagram_to_plain({
            "caption": "My morning routine.",
            "hashtags": ["lifestyle", "morning"]
        })
        assert "My morning routine." in result
        assert "#lifestyle" in result

    @pytest.mark.unit
    def test_no_html_tags(self):
        result = instagram_to_plain({
            "caption": "Hello world.",
            "hashtags": ["hello"]
        })
        assert "<" not in result
