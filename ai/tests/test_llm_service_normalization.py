import pytest

from services.llm_service import _normalize_meta_description, _prepare_blog_payload

pytestmark = pytest.mark.unit


def test_normalize_meta_description_keeps_keyword_and_length_range():
    sections = [
        {
            "h2": "Why it matters",
            "body": (
                "Sensory maximalism is shaping food trends 2026 through layered textures, bold visuals, "
                "playful contrasts, and shareable dining moments that stand out across social and search."
            ),
        }
    ]

    meta = _normalize_meta_description("", "Sensory Maximalism Guide", "food trends 2026", sections)

    assert "food trends 2026" in meta.lower()
    assert 140 <= len(meta) <= 160


def test_prepare_blog_payload_only_flags_severely_short_content():
    base_payload = {
        "title": "Sensory Maximalism",
        "sections": [
            {
                "h2": "Overview",
                "body": " ".join(["insight"] * 700),
            }
        ],
        "meta": {},
    }

    _, _, repair_issues = _prepare_blog_payload(
        base_payload,
        "Sensory Maximalism",
        "food trends 2026",
        1000,
    )

    assert "Content is significantly shorter than target length" not in repair_issues


def test_prepare_blog_payload_flags_very_short_content():
    base_payload = {
        "title": "Sensory Maximalism",
        "sections": [
            {
                "h2": "Overview",
                "body": " ".join(["insight"] * 500),
            }
        ],
        "meta": {},
    }

    _, _, repair_issues = _prepare_blog_payload(
        base_payload,
        "Sensory Maximalism",
        "food trends 2026",
        1000,
    )

    assert "Content is significantly shorter than target length" in repair_issues
