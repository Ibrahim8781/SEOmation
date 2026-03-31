"""
tests/test_rag_strategy.py
Unit tests for rag_strategy.py pure functions.
No external API calls.
"""

import pytest
from services.rag_strategy import (
    should_use_indexed_content_context,
    build_topic_live_queries,
    merge_snippet_sources,
    tokenize_terms,
    normalize_query_text,
)


# ---------------------------------------------------------------------------
# should_use_indexed_content_context
# ---------------------------------------------------------------------------

class TestShouldUseIndexedContentContext:

    @pytest.mark.unit
    def test_returns_true_when_niche_matches_topic(self):
        # "email marketing" appears verbatim in topic → guarantees phrase match → indexed=True
        result, meta = should_use_indexed_content_context(
            niche="email marketing",
            topic="email marketing automation for startups",
            focus_keyword="email automation",
            seed_keywords=["email", "marketing"]
        )
        assert result is True

    @pytest.mark.unit
    def test_returns_false_when_niche_is_empty(self):
        result, meta = should_use_indexed_content_context(
            niche="",
            topic="Any topic here",
            focus_keyword="any keyword",
            seed_keywords=[]
        )
        assert result is False
        assert meta["reason"] == "no_index_scope"

    @pytest.mark.unit
    def test_returns_false_when_topic_is_empty(self):
        result, meta = should_use_indexed_content_context(
            niche="SaaS technology",
            topic="",
            focus_keyword="",
            seed_keywords=["saas"]
        )
        assert result is False

    @pytest.mark.unit
    def test_returns_false_when_topic_is_off_niche(self):
        result, meta = should_use_indexed_content_context(
            niche="cooking recipes",
            topic="cryptocurrency investment strategies",
            focus_keyword="bitcoin trading",
            seed_keywords=[]
        )
        assert result is False
        assert meta["reason"] == "off_niche_live_only"

    @pytest.mark.unit
    def test_meta_always_has_required_keys(self):
        _, meta = should_use_indexed_content_context(
            niche="test niche",
            topic="test topic",
            focus_keyword="test keyword",
            seed_keywords=[]
        )
        required_keys = {"reason", "overlapTerms", "broadNiche", "memoryTerms", "requestTerms"}
        assert required_keys.issubset(meta.keys())

    @pytest.mark.unit
    def test_broad_niche_flag_set_correctly(self):
        _, meta = should_use_indexed_content_context(
            niche="technology",  # in BROAD_NICHE_TERMS
            topic="latest tech trends",
            focus_keyword="tech",
            seed_keywords=[]
        )
        assert meta["broadNiche"] is True

    @pytest.mark.unit
    def test_specific_niche_not_broad(self):
        _, meta = should_use_indexed_content_context(
            niche="SaaS project management tools",
            topic="best project management tools for developers",
            focus_keyword="project management",
            seed_keywords=[]
        )
        assert meta["broadNiche"] is False

    @pytest.mark.unit
    def test_phrase_match_triggers_indexed_context(self):
        """When niche phrase appears verbatim in topic, should use indexed context."""
        result, meta = should_use_indexed_content_context(
            niche="email marketing",
            topic="email marketing automation for startups",
            focus_keyword="email automation",
            seed_keywords=[]
        )
        assert result is True
        assert meta["phraseMatch"] is True


# ---------------------------------------------------------------------------
# build_topic_live_queries
# ---------------------------------------------------------------------------

class TestBuildTopicLiveQueries:

    @pytest.mark.unit
    def test_returns_non_empty_list(self):
        queries = build_topic_live_queries(
            niche="SaaS technology",
            seed_keywords=["startup", "software"],
            region="",
            season="",
            include_trends=True
        )
        assert isinstance(queries, list)
        assert len(queries) > 0

    @pytest.mark.unit
    def test_returns_max_3_queries(self):
        queries = build_topic_live_queries(
            niche="content marketing",
            seed_keywords=["seo", "blogging"],
            region="United States",
            season="summer",
            include_trends=True
        )
        assert len(queries) <= 3

    @pytest.mark.unit
    def test_without_trends_returns_content_ideas_query(self):
        queries = build_topic_live_queries(
            niche="fitness",
            seed_keywords=[],
            region="",
            season="",
            include_trends=False
        )
        # Second query should mention "content ideas" when no trends
        combined = " ".join(queries).lower()
        assert "content ideas" in combined

    @pytest.mark.unit
    def test_with_trends_returns_trends_query(self):
        queries = build_topic_live_queries(
            niche="fintech",
            seed_keywords=[],
            region="",
            season="",
            include_trends=True
        )
        combined = " ".join(queries).lower()
        assert "latest trends" in combined or "emerging" in combined

    @pytest.mark.unit
    def test_all_queries_are_non_empty_strings(self):
        queries = build_topic_live_queries(
            niche="health",
            seed_keywords=["wellness"],
            region="UK",
            season="winter",
            include_trends=True
        )
        for q in queries:
            assert isinstance(q, str)
            assert len(q.strip()) > 0

    @pytest.mark.unit
    def test_no_duplicate_queries(self):
        queries = build_topic_live_queries(
            niche="AI",
            seed_keywords=["machine learning"],
            region="",
            season="",
            include_trends=True
        )
        assert len(queries) == len(set(queries)), "Duplicate queries found"

    @pytest.mark.unit
    def test_empty_niche_uses_content_as_fallback(self):
        queries = build_topic_live_queries(
            niche="",
            seed_keywords=[],
            region="",
            season="",
            include_trends=True
        )
        assert len(queries) > 0
        assert all(len(q.strip()) > 0 for q in queries)


# ---------------------------------------------------------------------------
# merge_snippet_sources
# ---------------------------------------------------------------------------

class TestMergeSnippetSources:

    @pytest.mark.unit
    def test_merges_two_sources(self):
        group_a = [{"url": "https://a.com", "title": "A", "text": "Content A about SaaS"}]
        group_b = [{"url": "https://b.com", "title": "B", "text": "Content B about marketing"}]
        result = merge_snippet_sources(group_a, group_b)
        assert len(result) == 2

    @pytest.mark.unit
    def test_deduplicates_by_url(self):
        duplicate_url = "https://same.com"
        group_a = [{"url": duplicate_url, "title": "First", "text": "First content about SaaS"}]
        group_b = [{"url": duplicate_url, "title": "Second", "text": "Duplicate content about SaaS"}]
        result = merge_snippet_sources(group_a, group_b)
        urls = [s["url"] for s in result]
        assert urls.count(duplicate_url) == 1, "Duplicate URL not deduplicated"

    @pytest.mark.unit
    def test_skips_sources_without_text(self):
        group = [
            {"url": "https://a.com", "title": "A", "text": ""},
            {"url": "https://b.com", "title": "B", "text": "Valid content here"}
        ]
        result = merge_snippet_sources(group)
        assert len(result) == 1
        assert result[0]["url"] == "https://b.com"

    @pytest.mark.unit
    def test_respects_limit(self):
        sources = [
            {"url": f"https://site{i}.com", "title": f"Title {i}", "text": f"Content {i} is valid text"}
            for i in range(20)
        ]
        result = merge_snippet_sources(sources, limit=5)
        assert len(result) <= 5

    @pytest.mark.unit
    def test_result_items_have_url_title_text(self):
        group = [{"url": "https://test.com", "title": "Test Title", "text": "Some valid text content"}]
        result = merge_snippet_sources(group)
        assert len(result) == 1
        item = result[0]
        assert "url" in item
        assert "title" in item
        assert "text" in item

    @pytest.mark.unit
    def test_empty_input_returns_empty_list(self):
        result = merge_snippet_sources([])
        assert result == []


# ---------------------------------------------------------------------------
# tokenize_terms and normalize_query_text helpers
# ---------------------------------------------------------------------------

class TestHelpers:

    @pytest.mark.unit
    def test_tokenize_terms_filters_short_tokens(self):
        tokens = tokenize_terms("a an the SaaS")
        # "a", "an", "the" are stopwords or too short; "SaaS" should be included
        assert "saas" in tokens

    @pytest.mark.unit
    def test_tokenize_terms_returns_set(self):
        result = tokenize_terms("hello world hello")
        assert isinstance(result, set)
        assert "hello" in result

    @pytest.mark.unit
    def test_normalize_query_text_strips_whitespace(self):
        result = normalize_query_text("  hello   world  ")
        assert result == "hello world"

    @pytest.mark.unit
    def test_normalize_query_text_empty_string(self):
        assert normalize_query_text("") == ""
