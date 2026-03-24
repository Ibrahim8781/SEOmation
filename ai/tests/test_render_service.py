"""
Unit Tests for render_service.py
Covers: blog_to_html, blog_to_plain, linkedin_to_html, linkedin_to_plain,
        instagram_to_html, instagram_to_plain
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


class TestBlogToHtml:
    def test_includes_h1_from_data(self):
        data = {"h1": "My Blog Post", "sections": [], "faqs": []}
        result = blog_to_html(data)
        assert "<h1>My Blog Post</h1>" in result

    def test_includes_title_as_comment(self):
        data = {"title": "Page Title", "h1": "H1", "sections": [], "faqs": []}
        result = blog_to_html(data)
        assert "<!-- title:" in result
        assert "Page Title" in result

    def test_sections_rendered_as_h2_and_p(self):
        data = {
            "h1": "T",
            "sections": [{"h2": "Section One", "body": "Body text here."}],
            "faqs": []
        }
        result = blog_to_html(data)
        assert "<h2>Section One</h2>" in result
        assert "<p>" in result
        assert "Body text here." in result

    def test_faqs_rendered_as_h3_and_p(self):
        data = {
            "h1": "T",
            "sections": [],
            "faqs": [{"q": "What is SEO?", "a": "It stands for search engine optimization."}]
        }
        result = blog_to_html(data)
        assert "class='faqs'" in result
        assert "<h3>What is SEO?</h3>" in result
        assert "search engine optimization" in result

    def test_meta_description_as_comment(self):
        data = {
            "h1": "T",
            "sections": [],
            "faqs": [],
            "meta": {"description": "A great meta description."}
        }
        result = blog_to_html(data)
        assert "meta-description:" in result
        assert "A great meta description." in result

    def test_xss_escaped_in_title(self):
        data = {"title": "<script>alert(1)</script>", "h1": "Safe", "sections": [], "faqs": []}
        result = blog_to_html(data)
        assert "<script>" not in result
        assert "&lt;script&gt;" in result or "script" not in result.lower().replace("&lt;script&gt;", "")

    def test_xss_escaped_in_h1(self):
        data = {"h1": "<img onerror='evil()'>", "sections": [], "faqs": []}
        result = blog_to_html(data)
        # The raw, unescaped img tag must NOT appear – only the escaped form is acceptable
        assert "<img " not in result
        # The onerror attribute must be HTML-escaped, not raw
        assert "onerror='evil()'" not in result

    def test_empty_data(self):
        result = blog_to_html({})
        assert isinstance(result, str)

    def test_missing_h1_still_renders(self):
        data = {"sections": [{"h2": "Sec", "body": "Body"}], "faqs": []}
        result = blog_to_html(data)
        assert "<h2>Sec</h2>" in result

    def test_image_prompts_as_comment(self):
        data = {"h1": "T", "sections": [], "faqs": [], "images": ["prompt1", "prompt2"]}
        result = blog_to_html(data)
        assert "image-prompts" in result

    def test_sections_without_body(self):
        data = {"h1": "T", "sections": [{"h2": "Section", "body": ""}], "faqs": []}
        result = blog_to_html(data)
        assert "<h2>Section</h2>" in result

    def test_sections_without_h2(self):
        data = {"h1": "T", "sections": [{"h2": "", "body": "Just body text"}], "faqs": []}
        result = blog_to_html(data)
        assert "Just body text" in result


class TestBlogToPlain:
    def test_includes_title_and_h1(self):
        data = {"title": "Page Title", "h1": "H1 Heading", "sections": [], "faqs": []}
        result = blog_to_plain(data)
        assert "Page Title" in result
        assert "H1 Heading" in result

    def test_sections_appear_in_order(self):
        data = {
            "h1": "T",
            "sections": [
                {"h2": "First", "body": "Body one."},
                {"h2": "Second", "body": "Body two."}
            ],
            "faqs": []
        }
        result = blog_to_plain(data)
        assert result.index("First") < result.index("Second")

    def test_faqs_with_qa_format(self):
        data = {
            "h1": "T",
            "sections": [],
            "faqs": [{"q": "Question here?", "a": "Answer here."}]
        }
        result = blog_to_plain(data)
        assert "Q: Question here?" in result
        assert "A: Answer here." in result

    def test_empty_data(self):
        result = blog_to_plain({})
        assert isinstance(result, str)

    def test_no_html_tags_in_output(self):
        data = {"h1": "Title", "sections": [{"h2": "S", "body": "Body"}], "faqs": []}
        result = blog_to_plain(data)
        assert "<" not in result
        assert ">" not in result


class TestLinkedinRenderers:
    def test_html_wraps_body_in_p(self):
        data = {"body": "LinkedIn post content here.", "hashtags": []}
        result = linkedin_to_html(data)
        assert "<p>" in result
        assert "LinkedIn post content here." in result

    def test_html_includes_hashtags(self):
        data = {"body": "Content", "hashtags": ["SEO", "Marketing", "SaaS"]}
        result = linkedin_to_html(data)
        assert "#SEO" in result
        assert "#Marketing" in result

    def test_html_limits_hashtags_to_five(self):
        data = {"body": "Content", "hashtags": [f"tag{i}" for i in range(10)]}
        result = linkedin_to_html(data)
        count = result.count("#tag")
        assert count == 5

    def test_plain_includes_hashtags_with_hash(self):
        data = {"body": "My post body", "hashtags": ["growth", "saas"]}
        result = linkedin_to_plain(data)
        assert "#growth" in result
        assert "#saas" in result

    def test_plain_no_hashtags(self):
        data = {"body": "Just the body.", "hashtags": []}
        result = linkedin_to_plain(data)
        assert result == "Just the body."

    def test_html_xss_escaped_body(self):
        data = {"body": "<script>evil()</script>", "hashtags": []}
        result = linkedin_to_html(data)
        assert "<script>" not in result

    def test_empty_body(self):
        data = {"body": "", "hashtags": ["tag"]}
        result = linkedin_to_plain(data)
        assert "#tag" in result

    def test_missing_keys(self):
        assert isinstance(linkedin_to_html({}), str)
        assert isinstance(linkedin_to_plain({}), str)


class TestInstagramRenderers:
    def test_html_wraps_caption_in_p(self):
        data = {"caption": "Amazing post!", "hashtags": ["photo", "life"]}
        result = instagram_to_html(data)
        assert "<p>" in result
        assert "Amazing post!" in result

    def test_html_limits_hashtags_to_fifteen(self):
        data = {"caption": "Cap", "hashtags": [f"tag{i}" for i in range(20)]}
        result = instagram_to_html(data)
        count = result.count("#tag")
        assert count == 15

    def test_plain_appends_hashtags(self):
        data = {"caption": "Caption text", "hashtags": ["love", "fun"]}
        result = instagram_to_plain(data)
        assert "Caption text" in result
        assert "#love" in result
        assert "#fun" in result

    def test_plain_no_hashtags(self):
        data = {"caption": "Just caption.", "hashtags": []}
        result = instagram_to_plain(data)
        assert result == "Just caption."

    def test_xss_escaped_caption_in_html(self):
        data = {"caption": "<script>alert(1)</script>", "hashtags": []}
        result = instagram_to_html(data)
        assert "<script>" not in result

    def test_empty_caption(self):
        data = {"caption": "", "hashtags": ["empty"]}
        result = instagram_to_plain(data)
        assert "#empty" in result

    def test_missing_keys(self):
        assert isinstance(instagram_to_html({}), str)
        assert isinstance(instagram_to_plain({}), str)
