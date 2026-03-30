"""
tests/test_topics.py
POST /topic/suggest — real Groq API calls.

Requires in .env: GROQ_API_KEY
VECTOR_BACKEND=memory is fine (no Qdrant needed).
"""

import pytest


# ---------------------------------------------------------------------------
# Integration tests — call real Groq LLM
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_topic_suggest_returns_200(client, topic_suggest_payload):
    response = client.post("/topic/suggest", json=topic_suggest_payload)
    assert response.status_code == 200, response.text


@pytest.mark.integration
def test_topic_suggest_returns_clusters_list(client, topic_suggest_payload):
    response = client.post("/topic/suggest", json=topic_suggest_payload)
    body = response.json()
    assert "clusters" in body or "ideas" in body, f"Unexpected body: {body}"


@pytest.mark.integration
def test_topic_suggest_has_non_empty_topics(client, topic_suggest_payload):
    response = client.post("/topic/suggest", json=topic_suggest_payload)
    body = response.json()
    # Either clusters with ideas or top-level ideas list must be non-empty
    clusters = body.get("clusters", [])
    ideas = body.get("ideas", [])
    total_ideas = ideas[:]
    for cluster in clusters:
        total_ideas.extend(cluster.get("ideas", []))
    assert len(total_ideas) > 0, "Expected at least one topic idea in response"


@pytest.mark.integration
def test_topic_suggest_ideas_have_title_field(client, topic_suggest_payload):
    response = client.post("/topic/suggest", json=topic_suggest_payload)
    body = response.json()
    all_ideas = list(body.get("ideas", []))
    for cluster in body.get("clusters", []):
        all_ideas.extend(cluster.get("ideas", []))
    for idea in all_ideas[:3]:  # Check first 3 ideas
        assert "ideaText" in idea or "title" in idea or "text" in idea, \
            f"Idea missing title field: {idea}"


@pytest.mark.integration
def test_topic_suggest_has_diagnostics(client, topic_suggest_payload):
    response = client.post("/topic/suggest", json=topic_suggest_payload)
    body = response.json()
    assert "diagnostics" in body
    assert isinstance(body["diagnostics"], dict)


@pytest.mark.integration
def test_topic_suggest_with_trends_enabled(client, topic_suggest_payload):
    payload = {**topic_suggest_payload, "includeTrends": True}
    response = client.post("/topic/suggest", json=payload)
    assert response.status_code == 200


@pytest.mark.integration
def test_topic_suggest_with_trends_disabled(client, topic_suggest_payload):
    payload = {**topic_suggest_payload, "includeTrends": False}
    response = client.post("/topic/suggest", json=payload)
    assert response.status_code == 200


@pytest.mark.integration
def test_topic_suggest_with_region_and_season(client, topic_suggest_payload):
    payload = {**topic_suggest_payload, "region": "United States", "season": "winter"}
    response = client.post("/topic/suggest", json=payload)
    assert response.status_code == 200


@pytest.mark.integration
def test_topic_suggest_respects_count_limit(client, topic_suggest_payload):
    payload = {**topic_suggest_payload, "count": 3, "includeTrends": False}
    response = client.post("/topic/suggest", json=payload)
    assert response.status_code == 200
    body = response.json()
    all_ideas = list(body.get("ideas", []))
    for cluster in body.get("clusters", []):
        all_ideas.extend(cluster.get("ideas", []))
    # Should not return massively more than requested (allow some overflow from clusters)
    assert len(all_ideas) <= 20, f"Too many ideas returned: {len(all_ideas)}"


@pytest.mark.integration
def test_topic_suggest_different_niches_produce_different_topics(client, topic_suggest_payload):
    """Topics for different niches should not be identical."""
    saas_payload = {**topic_suggest_payload, "niche": "SaaS technology", "includeTrends": False}
    health_payload = {**topic_suggest_payload, "niche": "health and wellness", "includeTrends": False}

    saas_res = client.post("/topic/suggest", json=saas_payload)
    health_res = client.post("/topic/suggest", json=health_payload)

    assert saas_res.status_code == 200
    assert health_res.status_code == 200

    def extract_titles(body):
        titles = set()
        for idea in body.get("ideas", []):
            t = idea.get("ideaText") or idea.get("title") or idea.get("text") or ""
            titles.add(t.lower())
        for cluster in body.get("clusters", []):
            for idea in cluster.get("ideas", []):
                t = idea.get("ideaText") or idea.get("title") or idea.get("text") or ""
                titles.add(t.lower())
        return titles

    saas_titles = extract_titles(saas_res.json())
    health_titles = extract_titles(health_res.json())
    # They should not be exactly identical
    assert saas_titles != health_titles, "Different niches produced identical topics"


# ---------------------------------------------------------------------------
# Validation tests — no external API calls needed
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_topic_suggest_missing_niche_returns_422(client, topic_suggest_payload):
    payload = {k: v for k, v in topic_suggest_payload.items() if k != "niche"}
    response = client.post("/topic/suggest", json=payload)
    assert response.status_code == 422


@pytest.mark.unit
def test_topic_suggest_empty_body_returns_422(client):
    response = client.post("/topic/suggest", json={})
    assert response.status_code == 422
