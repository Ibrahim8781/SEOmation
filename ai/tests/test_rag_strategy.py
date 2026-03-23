from services.rag_strategy import (
    build_topic_live_queries,
    merge_query_terms,
    merge_snippet_sources,
    should_use_indexed_content_context,
)


def test_should_use_indexed_content_context_for_on_niche_topic():
    use_indexed, details = should_use_indexed_content_context(
        niche="Cricket",
        topic="Pakistan cricket breaking news",
        focus_keyword="Pakistan cricket news",
        seed_keywords=["Pakistan cricket", "PCB"],
    )

    assert use_indexed is True
    assert details["reason"] == "aligned_with_niche"
    assert "cricket" in details["overlapTerms"]


def test_should_skip_indexed_content_context_for_off_niche_topic():
    use_indexed, details = should_use_indexed_content_context(
        niche="Cricket",
        topic="Manchester United top scorers and assists",
        focus_keyword="Manchester United",
        seed_keywords=["Pakistan cricket", "PCB"],
    )

    assert use_indexed is False
    assert details["reason"] == "off_niche_live_only"


def test_build_topic_live_queries_keeps_queries_unique():
    queries = build_topic_live_queries(
        niche="Cricket",
        seed_keywords=["Cricket", "Pakistan cricket"],
        region="PK",
        season="Q4",
        include_trends=True,
    )

    assert len(queries) <= 3
    assert len(set(query.casefold() for query in queries)) == len(queries)
    assert any("latest trends" in query.lower() for query in queries)


def test_build_topic_live_queries_prefers_seed_before_broad_niche():
    queries = build_topic_live_queries(
        niche="News",
        seed_keywords=["Geo"],
        region="Global",
        season="",
        include_trends=True,
    )

    assert queries[0] == "Geo News"
    assert queries[2] == "Geo News Global insights"


def test_merge_snippet_sources_deduplicates_urls():
    snippets = merge_snippet_sources(
        [{"url": "https://example.com/a", "title": "A", "text": "alpha beta gamma"}],
        [{"url": "https://example.com/a", "title": "A2", "text": "alpha beta gamma delta"}],
        [{"url": "https://example.com/b", "title": "B", "text": "delta epsilon zeta"}],
    )

    assert len(snippets) == 2
    assert snippets[0]["url"] == "https://example.com/a"
    assert snippets[1]["url"] == "https://example.com/b"


def test_merge_query_terms_avoids_duplicate_words():
    merged = merge_query_terms("Pakistan cricket news", "Breaking cricket news")
    assert merged == "Pakistan cricket news Breaking"


def test_merge_query_terms_ignores_connector_words_from_secondary_phrase():
    merged = merge_query_terms("media impact on society", "Role of media in society")
    assert merged == "media impact on society Role"


def test_should_use_indexed_content_context_for_broad_niche_overlap():
    use_indexed, details = should_use_indexed_content_context(
        niche="News",
        topic="Breaking cricket news",
        focus_keyword="cricket news",
        seed_keywords=[],
    )

    assert use_indexed is True
    assert details["reason"] == "aligned_with_niche"
    assert details["broadNiche"] is True
