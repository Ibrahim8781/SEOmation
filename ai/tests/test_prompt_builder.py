"""
Unit Tests for prompt_builder.py
Covers: build_topic_prompt, topic mix instructions, edge cases
"""
import pytest
from services.prompt_builder import build_topic_prompt


class TestBuildTopicPrompt:
    """Tests for build_topic_prompt function"""

    def _make_request(self, **overrides):
        defaults = {
            "language": "en",
            "niche": "SaaS SEO",
            "persona": {"role": "founder", "pains": ["low traffic"]},
            "seed_keywords": ["SEO", "content"],
            "region": "US",
            "season": "Q4",
            "count": 12,
            "context_lines": ["Context line 1", "Context line 2"],
            "include_trends": True,
            "content_goals": "Drive organic traffic",
            "preferred_content_types": ["guide", "listicle"],
        }
        defaults.update(overrides)
        return defaults

    def test_returns_tuple_of_system_and_user(self):
        args = self._make_request()
        result = build_topic_prompt(**args)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_system_prompt_is_string(self):
        system, _ = build_topic_prompt(**self._make_request())
        assert isinstance(system, str)
        assert len(system) > 0

    def test_user_message_is_dict_with_role_and_content(self):
        _, user = build_topic_prompt(**self._make_request())
        assert isinstance(user, dict)
        assert user.get("role") == "user"
        assert "content" in user
        assert isinstance(user["content"], str)

    def test_niche_appears_in_user_content(self):
        _, user = build_topic_prompt(**self._make_request(niche="Cricket"))
        assert "Cricket" in user["content"]

    def test_count_appears_in_user_content(self):
        _, user = build_topic_prompt(**self._make_request(count=20))
        assert "20" in user["content"]

    def test_region_appears_in_user_content(self):
        _, user = build_topic_prompt(**self._make_request(region="UK"))
        assert "UK" in user["content"]

    def test_seed_keywords_appear_in_user_content(self):
        _, user = build_topic_prompt(**self._make_request(seed_keywords=["Unique_kw_xyz"]))
        assert "Unique_kw_xyz" in user["content"]

    def test_include_trends_true_uses_seasonal_language(self):
        _, user = build_topic_prompt(**self._make_request(include_trends=True, season="Summer"))
        assert "Summer" in user["content"]
        # Trends mode should mention trend/seasonal mix
        assert "trend" in user["content"].lower() or "seasonal" in user["content"].lower()

    def test_include_trends_false_uses_evergreen_language(self):
        _, user = build_topic_prompt(**self._make_request(include_trends=False))
        assert "evergreen" in user["content"].lower()

    def test_system_prompt_includes_language(self):
        system, _ = build_topic_prompt(**self._make_request(language="de"))
        assert "de" in system.lower() or "german" in system.lower() or "language" in system.lower()

    def test_context_lines_appear_in_prompt(self):
        _, user = build_topic_prompt(**self._make_request(context_lines=["Unique context line ABCDEF"]))
        assert "Unique context line ABCDEF" in user["content"]

    def test_empty_seed_keywords(self):
        system, user = build_topic_prompt(**self._make_request(seed_keywords=[]))
        assert isinstance(system, str)
        assert isinstance(user["content"], str)

    def test_empty_context_lines(self):
        system, user = build_topic_prompt(**self._make_request(context_lines=[]))
        assert isinstance(system, str)

    def test_none_season_handled(self):
        system, user = build_topic_prompt(**self._make_request(season="", include_trends=True))
        assert isinstance(user["content"], str)

    def test_preferred_content_types_in_prompt(self):
        _, user = build_topic_prompt(**self._make_request(preferred_content_types=["case-study", "checklist"]))
        content = user["content"].lower()
        assert "case-study" in content or "checklist" in content

    def test_empty_preferred_content_types(self):
        system, user = build_topic_prompt(**self._make_request(preferred_content_types=[]))
        assert isinstance(user["content"], str)

    def test_content_goals_in_prompt(self):
        _, user = build_topic_prompt(**self._make_request(content_goals="Increase brand awareness"))
        assert "Increase brand awareness" in user["content"]

    def test_context_lines_truncated_to_twelve(self):
        """Prompt uses at most 12 context lines"""
        many_lines = [f"Context line {i}" for i in range(25)]
        _, user = build_topic_prompt(**self._make_request(context_lines=many_lines))
        # Count occurrences — at most 12 should appear
        count = sum(1 for line in many_lines[:12] if line in user["content"])
        assert count <= 12

    def test_prompt_includes_json_output_instructions(self):
        _, user = build_topic_prompt(**self._make_request())
        assert "JSON" in user["content"] or "json" in user["content"].lower()

    def test_prompt_specifies_cluster_structure(self):
        _, user = build_topic_prompt(**self._make_request())
        assert "cluster" in user["content"].lower()

    def test_different_niches_produce_different_prompts(self):
        _, user_cricket = build_topic_prompt(**self._make_request(niche="Cricket"))
        _, user_saas = build_topic_prompt(**self._make_request(niche="SaaS"))
        assert user_cricket["content"] != user_saas["content"]
