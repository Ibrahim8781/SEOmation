import asyncio

import pytest

from services import content_research_service


@pytest.mark.unit
@pytest.mark.asyncio
async def test_content_research_reuses_inflight_and_cached_result(monkeypatch):
    calls = {"count": 0}
    cache_token = "test-content-research-cache"

    async def fake_build(**kwargs):
        calls["count"] += 1
        await asyncio.sleep(0.01)
        return {
            "retrievedContext": {
                "snippets": [],
                "usedRAG": False,
                "liveSources": 0,
                "indexedSources": 0,
                "keywords": [],
            },
            "indexedPolicy": {"reason": "aligned_with_niche", "overlapTerms": ["food"]},
            "indexedNamespace": kwargs["namespace"],
            "useIndexedContext": True,
            "ragMode": "live-only",
            "token": cache_token,
        }

    content_research_service._RESEARCH_IN_FLIGHT.clear()
    monkeypatch.setattr(content_research_service, "_build_content_research", fake_build)

    kwargs = {
        "user_id": "user-1",
        "language": "en",
        "topic_or_idea": "Sensory maximalism",
        "focus_keyword": "food trends 2026",
        "include_trend": True,
        "niche": "food",
        "seed_keywords": ["food"],
        "region": "US",
        "season": None,
        "persona": {"role": "food reader", "pains": []},
        "namespace": "user-1:en:food",
    }

    first, second = await asyncio.gather(
        content_research_service.get_content_research_bundle(**kwargs),
        content_research_service.get_content_research_bundle(**kwargs),
    )
    third = await content_research_service.get_content_research_bundle(**kwargs)

    assert calls["count"] == 1
    assert first["token"] == cache_token
    assert second["token"] == cache_token
    assert third["token"] == cache_token
