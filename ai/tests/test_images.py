"""
tests/test_images.py
POST /image/generate — real image provider API calls.

Requires at least one of: TOGETHER_API_KEY, KIE_API_KEY, HUGGINGFACE_API_KEY
The "placeholder" provider always works as a last resort.
"""

import pytest


# ---------------------------------------------------------------------------
# Integration tests — real provider calls
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_image_generate_returns_200(client, image_generate_payload):
    response = client.post("/image/generate", json=image_generate_payload)
    assert response.status_code == 200, response.text


@pytest.mark.integration
def test_image_generate_returns_images_list(client, image_generate_payload):
    response = client.post("/image/generate", json=image_generate_payload)
    body = response.json()
    assert "images" in body, f"Missing 'images' key: {body.keys()}"
    assert isinstance(body["images"], list)
    assert len(body["images"]) > 0, "Expected at least one image in response"


@pytest.mark.integration
def test_image_has_url_or_base64(client, image_generate_payload):
    response = client.post("/image/generate", json=image_generate_payload)
    body = response.json()
    img = body["images"][0]
    has_url = bool(img.get("url"))
    has_base64 = bool(img.get("base64"))
    assert has_url or has_base64, f"Image missing both url and base64: {img.keys()}"


@pytest.mark.integration
def test_image_has_provider_field(client, image_generate_payload):
    response = client.post("/image/generate", json=image_generate_payload)
    img = response.json()["images"][0]
    assert "provider" in img, f"Image missing 'provider' field: {img.keys()}"
    assert isinstance(img["provider"], str)
    assert len(img["provider"]) > 0


@pytest.mark.integration
def test_image_has_alt_text(client, image_generate_payload):
    response = client.post("/image/generate", json=image_generate_payload)
    body = response.json()
    assert "altText" in body
    assert isinstance(body["altText"], str)


@pytest.mark.integration
def test_image_size_field_present(client, image_generate_payload):
    response = client.post("/image/generate", json=image_generate_payload)
    img = response.json()["images"][0]
    assert "size" in img or ("width" in img and "height" in img), \
        f"Image missing size info: {img.keys()}"


@pytest.mark.integration
def test_image_generate_with_different_prompt(client):
    """A different prompt should succeed (providers are prompt-agnostic)."""
    payload = {
        "prompt": "A colorful abstract representation of data analytics",
        "platform": "blog",
        "style": None,
        "sizes": ["512x512"],
        "count": 1,
        "language": "en"
    }
    response = client.post("/image/generate", json=payload)
    assert response.status_code == 200


@pytest.mark.integration
def test_image_generate_fallback_chain(client):
    """
    Provider fallback: with IMAGE_PROVIDER_ORDER ending in 'placeholder',
    the placeholder always returns a valid image even if other providers fail.
    """
    response = client.post("/image/generate", json={
        "prompt": "Test image for fallback chain verification",
        "platform": "blog",
        "style": None,
        "sizes": ["256x256"],
        "count": 1,
        "language": "en"
    })
    assert response.status_code == 200
    images = response.json().get("images", [])
    assert len(images) > 0


# ---------------------------------------------------------------------------
# Validation — no external API needed
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_image_generate_missing_prompt_returns_422(client):
    response = client.post("/image/generate", json={
        "platform": "blog",
        "sizes": ["512x512"]
    })
    assert response.status_code == 422


@pytest.mark.unit
def test_image_generate_empty_body_returns_422(client):
    response = client.post("/image/generate", json={})
    assert response.status_code == 422
