import re
from typing import Dict, Iterable, List, Sequence, Set, Tuple


CONNECTOR_STOPWORDS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "this",
    "that",
    "to",
    "vs",
    "with",
}

CONTEXT_STOPWORDS = CONNECTOR_STOPWORDS | {
    "today",
    "latest",
    "analysis",
    "preview",
    "breaking",
    "top",
    "current",
    "now",
    "guide",
    "tutorial",
    "tips",
    "themes",
    "insights",
}

BROAD_NICHE_TERMS = {
    "business",
    "education",
    "entertainment",
    "finance",
    "health",
    "lifestyle",
    "marketing",
    "media",
    "news",
    "sports",
    "technology",
    "tech",
    "travel",
}


def tokenize_terms(*parts: str) -> Set[str]:
    tokens: Set[str] = set()
    for part in parts:
        for token in re.findall(r"[a-z0-9]+", str(part or "").lower()):
            if len(token) < 3:
                continue
            if token in CONTEXT_STOPWORDS:
                continue
            tokens.add(token)
    return tokens


def normalize_query_text(text: str) -> str:
    return " ".join(str(text or "").split()).strip()


def _is_short_acronym(text: str) -> bool:
    letters_only = re.sub(r"[^A-Za-z]", "", str(text or ""))
    return 2 <= len(letters_only) <= 5 and letters_only.isupper()


def _query_tokens(text: str, *, keep_connectors: bool) -> List[str]:
    tokens: List[str] = []
    seen = set()

    for token in re.findall(r"[A-Za-z0-9]+", str(text or "")):
        folded = token.casefold()
        if len(folded) < 2:
            continue
        if not keep_connectors and folded in CONNECTOR_STOPWORDS:
            continue
        if folded in seen:
            continue
        seen.add(folded)
        tokens.append(token)

    return tokens


def merge_query_terms(primary: str, secondary: str) -> str:
    primary_terms = [term for term in re.findall(r"[A-Za-z0-9]+", normalize_query_text(primary))]
    if not primary_terms:
        return " ".join(_query_tokens(secondary, keep_connectors=False)).strip()

    seen = {term.casefold() for term in primary_terms}
    merged = list(primary_terms)

    for term in _query_tokens(secondary, keep_connectors=False):
        folded = term.casefold()
        if folded in seen:
            continue
        seen.add(folded)
        merged.append(term)

    return " ".join(merged).strip()


def should_use_indexed_content_context(
    niche: str,
    topic: str,
    focus_keyword: str,
    seed_keywords: Sequence[str],
) -> Tuple[bool, Dict[str, object]]:
    normalized_niche = normalize_query_text(niche).lower()
    niche_terms = tokenize_terms(niche)
    memory_terms = tokenize_terms(niche, " ".join(seed_keywords or []))
    request_terms = tokenize_terms(topic, focus_keyword)
    broad_niche = bool(niche_terms) and all(term in BROAD_NICHE_TERMS for term in niche_terms)

    if not memory_terms:
        return False, {
            "reason": "no_index_scope",
            "overlapTerms": [],
            "memoryTerms": [],
            "broadNiche": broad_niche,
            "requestTerms": sorted(request_terms),
        }

    if not request_terms:
        return False, {
            "reason": "no_request_terms",
            "overlapTerms": [],
            "broadNiche": broad_niche,
            "memoryTerms": sorted(memory_terms),
            "requestTerms": [],
        }

    overlap_terms = sorted(memory_terms & request_terms)
    overlap_count = len(overlap_terms)
    memory_ratio = overlap_count / max(len(memory_terms), 1)
    request_ratio = overlap_count / max(len(request_terms), 1)
    topic_text = f"{topic} {focus_keyword}".strip().lower()
    phrase_match = bool(normalized_niche) and (
        normalized_niche in topic_text or topic_text in normalized_niche
    )

    allow_indexed = (
        phrase_match
        or overlap_count >= 2
        or (
            overlap_count >= 1
            and (broad_niche or (memory_ratio >= 0.34 and request_ratio >= 0.2))
        )
    )

    reason = "aligned_with_niche" if allow_indexed else "off_niche_live_only"
    return allow_indexed, {
        "reason": reason,
        "overlapTerms": overlap_terms,
        "broadNiche": broad_niche,
        "memoryTerms": sorted(memory_terms),
        "requestTerms": sorted(request_terms),
        "phraseMatch": phrase_match,
        "memoryOverlapRatio": round(memory_ratio, 3),
        "requestOverlapRatio": round(request_ratio, 3),
    }


def docs_to_snippets(docs: Iterable[Dict[str, object]], text_limit: int = 900) -> List[Dict[str, str]]:
    snippets: List[Dict[str, str]] = []
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        content_text = " ".join(str(doc.get("content", "")).split()).strip()
        if not content_text:
            continue
        snippets.append({
            "url": str(doc.get("url", "") or ""),
            "title": str(doc.get("title", "") or "Reference source"),
            "text": content_text[:text_limit],
        })
    return snippets


def merge_snippet_sources(
    *source_groups: Iterable[Dict[str, object]],
    limit: int = 12,
    text_limit: int = 900,
) -> List[Dict[str, str]]:
    merged: List[Dict[str, str]] = []
    seen_keys = set()

    for group in source_groups:
        for source in group:
            if not isinstance(source, dict):
                continue
            text = " ".join(str(source.get("text", "")).split()).strip()
            if not text:
                continue
            key = (source.get("url") or text[:120]).strip().lower()
            if not key or key in seen_keys:
                continue
            seen_keys.add(key)
            merged.append({
                "url": str(source.get("url", "") or ""),
                "title": str(source.get("title") or source.get("url") or "Reference source"),
                "text": text[:text_limit],
            })
            if len(merged) >= limit:
                return merged

    return merged


def build_topic_live_queries(
    niche: str,
    seed_keywords: Sequence[str],
    region: str,
    season: str,
    include_trends: bool,
) -> List[str]:
    normalized_niche = normalize_query_text(niche)
    first_seed = next(
        (normalize_query_text(keyword) for keyword in seed_keywords or [] if normalize_query_text(keyword)),
        "",
    )

    if first_seed:
        if normalized_niche and normalized_niche.casefold() in first_seed.casefold():
            subject = first_seed
        elif _is_short_acronym(first_seed):
            subject = merge_query_terms(normalized_niche, first_seed)
        else:
            subject = merge_query_terms(first_seed, normalized_niche)
    else:
        subject = normalized_niche

    subject = subject or normalized_niche or "content"
    queries = [subject]

    if include_trends:
        queries.append(f"{subject} latest trends")
        context_suffix = " ".join(
            bit for bit in [normalize_query_text(region), normalize_query_text(season)] if bit
        ).strip()
        if region and season:
            queries.append(f"{subject} {context_suffix} insights")
        elif region or season:
            queries.append(f"{subject} {context_suffix} insights")
        else:
            queries.append(f"{subject} emerging themes")
    else:
        queries.append(f"{subject} content ideas")

    ordered: List[str] = []
    seen = set()
    for query in queries:
        cleaned = " ".join(str(query or "").split()).strip()
        if not cleaned:
            continue
        folded = cleaned.casefold()
        if folded in seen:
            continue
        seen.add(folded)
        ordered.append(cleaned)
    return ordered[:3]
