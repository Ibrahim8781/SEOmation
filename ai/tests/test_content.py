"""
tests/test_content.py
POST /content/generate — real Gemini API calls.

Requires in .env: GEMINI_API_KEY
"""

import pytest


# ---------------------------------------------------------------------------
# Integration tests — real Gemini calls
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_blog_content_returns_200(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    assert response.status_code == 200, response.text


@pytest.mark.integration
def test_blog_content_has_content_for_editor(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    body = response.json()
    assert "contentForEditor" in body, f"Missing contentForEditor: {body.keys()}"


@pytest.mark.integration
def test_blog_content_html_is_non_empty(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    body = response.json()
    html = body.get("contentForEditor", {}).get("html", "")
    assert isinstance(html, str)
    assert len(html) > 100, f"HTML content too short: {len(html)} chars"


@pytest.mark.integration
def test_blog_content_html_contains_html_tags(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    html = response.json().get("contentForEditor", {}).get("html", "")
    assert "<" in html and ">" in html, "Expected HTML tags in blog content"


@pytest.mark.integration
def test_blog_content_has_metrics(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    body = response.json()
    assert "metrics" in body
    metrics = body["metrics"]
    assert isinstance(metrics, dict)


@pytest.mark.integration
def test_blog_content_metrics_have_grammar_and_readability(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    metrics = response.json().get("metrics", {})
    assert "grammarScore" in metrics
    assert "readabilityScore" in metrics


@pytest.mark.integration
def test_blog_content_has_diagnostics(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    body = response.json()
    assert "diagnostics" in body


@pytest.mark.integration
def test_blog_content_plain_text_is_non_empty(client, blog_generate_payload):
    response = client.post("/content/generate", json=blog_generate_payload)
    plain = response.json().get("contentForEditor", {}).get("plainText", "")
    assert isinstance(plain, str)
    assert len(plain) > 50, f"Plain text too short: {len(plain)} chars"


@pytest.mark.integration
def test_linkedin_content_returns_200(client, linkedin_generate_payload):
    response = client.post("/content/generate", json=linkedin_generate_payload)
    assert response.status_code == 200, response.text


@pytest.mark.integration
def test_linkedin_content_is_shorter_than_blog(client, blog_generate_payload, linkedin_generate_payload):
    blog_res = client.post("/content/generate", json=blog_generate_payload)
    li_res = client.post("/content/generate", json=linkedin_generate_payload)
    assert blog_res.status_code == 200
    assert li_res.status_code == 200
    blog_text = blog_res.json().get("contentForEditor", {}).get("plainText", "")
    li_text = li_res.json().get("contentForEditor", {}).get("plainText", "")
    # LinkedIn content should be considerably shorter
    assert len(li_text) < len(blog_text), "LinkedIn content should be shorter than blog content"


@pytest.mark.integration
def test_instagram_content_returns_200(client, instagram_generate_payload):
    response = client.post("/content/generate", json=instagram_generate_payload)
    assert response.status_code == 200, response.text


@pytest.mark.integration
def test_focus_keyword_appears_in_generated_content(client, blog_generate_payload):
    """Focus keyword should appear at least once in the generated content."""
    response = client.post("/content/generate", json=blog_generate_payload)
    assert response.status_code == 200
    html = response.json().get("contentForEditor", {}).get("html", "")
    plain = response.json().get("contentForEditor", {}).get("plainText", "")
    keyword = blog_generate_payload["focusKeyword"].lower()
    combined = (html + plain).lower()
    assert keyword in combined, f"Focus keyword '{keyword}' not found in generated content"


@pytest.mark.integration
def test_different_topics_produce_different_content(client, blog_generate_payload):
    """Two different topic requests should produce non-identical content."""
    payload_a = {**blog_generate_payload, "topicOrIdea": "How to build a SaaS product"}
    payload_b = {**blog_generate_payload, "topicOrIdea": "Email marketing for small businesses",
                 "focusKeyword": "email marketing"}

    res_a = client.post("/content/generate", json=payload_a)
    res_b = client.post("/content/generate", json=payload_b)
    assert res_a.status_code == 200
    assert res_b.status_code == 200

    html_a = res_a.json().get("contentForEditor", {}).get("html", "")
    html_b = res_b.json().get("contentForEditor", {}).get("html", "")
    assert html_a != html_b, "Different topics should produce different content"


# ---------------------------------------------------------------------------
# Validation — no external API needed
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_content_generate_missing_topic_returns_422(client, blog_generate_payload):
    payload = {k: v for k, v in blog_generate_payload.items() if k != "topicOrIdea"}
    response = client.post("/content/generate", json=payload)
    assert response.status_code == 422


@pytest.mark.unit
def test_content_generate_empty_body_returns_422(client):
    response = client.post("/content/generate", json={})
    assert response.status_code == 422


@pytest.mark.unit
def test_content_generate_missing_platform_returns_422(client, blog_generate_payload):
    payload = {k: v for k, v in blog_generate_payload.items() if k != "platform"}
    response = client.post("/content/generate", json=payload)
    assert response.status_code == 422
