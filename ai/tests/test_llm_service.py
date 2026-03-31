"""
tests/test_llm_service.py
Integration tests for llm_service — real Groq API calls.

Requires in .env: GROQ_API_KEY
"""

import pytest
from services.llm_service import chat_groq, generate_topics_json


# ---------------------------------------------------------------------------
# chat_groq — real Groq call
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_chat_groq_returns_string():
    """chat_groq should return a non-empty string."""
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Reply with exactly one word: Hello"}
    ]
    result = await chat_groq(messages, max_tokens=10, temperature=0)
    assert isinstance(result, str)
    assert len(result.strip()) > 0


@pytest.mark.integration
async def test_chat_groq_respects_max_tokens():
    """With very low max_tokens, response should be brief."""
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write a 1000-word essay about the moon."}
    ]
    result = await chat_groq(messages, max_tokens=20, temperature=0)
    assert isinstance(result, str)
    assert len(result) < 500  # Generous upper bound


@pytest.mark.integration
async def test_generate_topics_json_returns_tuple():
    """generate_topics_json should return (clusters, ideas, diagnostics) tuple."""
    clusters, ideas, diagnostics = await generate_topics_json(
        language="en",
        niche="SaaS technology",
        persona={"role": "content creator", "pains": ["low traffic"]},
        seed_keywords=["saas", "software"],
        region=None,
        season=None,
        count=3,
        retrieved_context="",
        include_trends=False,
        content_goals=None,
        preferred_content_types=[]
    )
    assert isinstance(clusters, list), f"Expected list for clusters, got {type(clusters)}"
    assert isinstance(ideas, list), f"Expected list for ideas, got {type(ideas)}"
    assert isinstance(diagnostics, dict), f"Expected dict for diagnostics, got {type(diagnostics)}"


@pytest.mark.integration
async def test_generate_topics_json_produces_non_empty_results():
    """Should produce at least some topic ideas."""
    clusters, ideas, diagnostics = await generate_topics_json(
        language="en",
        niche="digital marketing",
        persona={"role": "marketer", "pains": []},
        seed_keywords=["seo", "content"],
        region=None,
        season=None,
        count=5,
        retrieved_context="",
        include_trends=False,
        content_goals=None,
        preferred_content_types=[]
    )
    total = len(ideas)
    for c in clusters:
        total += len(c.get("ideas", []))
    assert total > 0, "generate_topics_json returned zero topic ideas"


@pytest.mark.integration
async def test_generate_topics_json_diagnostics_has_source():
    """Diagnostics dict should have at least one key."""
    _, _, diagnostics = await generate_topics_json(
        language="en",
        niche="e-commerce",
        persona={"role": "store owner", "pains": []},
        seed_keywords=[],
        region=None,
        season=None,
        count=3,
        retrieved_context="",
        include_trends=False,
        content_goals=None,
        preferred_content_types=[]
    )
    assert len(diagnostics) > 0, f"Diagnostics is empty: {diagnostics}"


@pytest.mark.integration
async def test_generate_topics_json_cluster_has_label_and_ideas():
    """If clusters are returned, each should have label and ideas."""
    clusters, _, _ = await generate_topics_json(
        language="en",
        niche="health and fitness",
        persona={"role": "health blogger", "pains": []},
        seed_keywords=["workout", "nutrition"],
        region=None,
        season=None,
        count=5,
        retrieved_context="",
        include_trends=False,
        content_goals=None,
        preferred_content_types=[]
    )
    for cluster in clusters:
        assert "label" in cluster, f"Cluster missing label: {cluster}"
        assert "ideas" in cluster, f"Cluster missing ideas: {cluster}"
        assert isinstance(cluster["ideas"], list)
