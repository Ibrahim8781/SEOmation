import re
from typing import Dict, List


TERMINAL_PUNCTUATION = ".!?؟۔。！？"
LATIN_VOWELS = "aeiouy"
GERMAN_VOWELS = "aeiouyäöü"
CJK_LANGUAGES = {"zh", "ja", "ko"}


def score_content_metrics(html: str, plain_text: str, language: str) -> Dict[str, float | None]:
    text = _normalize_text(plain_text or _strip_html(html))
    if not text:
        return {
            "grammarScore": None,
            "readabilityScore": None,
            "ragScore": None,
        }

    normalized_language = str(language or "en").split("-")[0].lower()
    sentences = _split_sentences(text)
    grammar_score = _score_grammar(text, sentences, normalized_language)
    readability_score = _score_readability(text, sentences, normalized_language)

    return {
        "grammarScore": round(grammar_score, 2),
        "readabilityScore": round(readability_score, 2),
        "ragScore": None,
    }


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", str(text or ""))


def _normalize_text(text: str) -> str:
    normalized = str(text or "").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _split_sentences(text: str) -> List[str]:
    segments = re.split(r"(?<=[.!?؟۔。！？])\s+|\n+", text)
    return [segment.strip() for segment in segments if segment and segment.strip()]


def _tokenize_words(text: str) -> List[str]:
    tokens = re.findall(r"[^\W_]+(?:[-'][^\W_]+)*", text, flags=re.UNICODE)
    return [token for token in tokens if any(char.isalpha() for char in token)]


def _contains_cased_text(text: str) -> bool:
    return any(char.islower() for char in text) and any(char.isupper() for char in text)


def _is_heading_like(sentence: str) -> bool:
    words = _tokenize_words(sentence)
    return bool(words) and len(words) <= 10 and sentence[-1] not in TERMINAL_PUNCTUATION


def _score_grammar(text: str, sentences: List[str], language: str) -> float:
    effective_sentences = [sentence for sentence in sentences if not _is_heading_like(sentence)]
    if not effective_sentences:
        effective_sentences = sentences or [text]

    sentence_count = max(len(effective_sentences), 1)
    uses_case = _contains_cased_text(text) and language not in CJK_LANGUAGES

    lowercase_starts = 0
    long_sentences = 0

    for sentence in effective_sentences:
        stripped = sentence.lstrip("\"'([{“‘")
        first_alpha = next((char for char in stripped if char.isalpha()), "")
        if uses_case and first_alpha and first_alpha.islower():
            lowercase_starts += 1

        if language in CJK_LANGUAGES:
            unit_count = len(_cjk_units(sentence))
            if unit_count > 70:
                long_sentences += 1
        else:
            word_count = len(_tokenize_words(sentence))
            if word_count > 35:
                long_sentences += 1

    repeated_punctuation = len(re.findall(r"([!?.,;:])\1{2,}", text))
    repeated_words = len(
        re.findall(r"\b([^\W_]+(?:[-'][^\W_]+)*)\s+\1\b", text, flags=re.IGNORECASE | re.UNICODE)
    )
    extra_space_runs = len(re.findall(r"[ \t]{2,}", text))
    unmatched_pairs = sum(
        int(text.count(opening) != text.count(closing))
        for opening, closing in (("(", ")"), ("[", "]"), ("{", "}"), ('"', '"'))
    )

    last_body_sentence = next(
        (sentence for sentence in reversed(effective_sentences) if _tokenize_words(sentence)),
        "",
    )
    missing_terminal = int(
        bool(last_body_sentence)
        and len(_tokenize_words(last_body_sentence)) >= 8
        and last_body_sentence[-1] not in TERMINAL_PUNCTUATION
    )

    penalty = 0.0
    penalty += (lowercase_starts / sentence_count) * 22
    penalty += (long_sentences / sentence_count) * 18
    penalty += repeated_punctuation * 5
    penalty += repeated_words * 6
    penalty += extra_space_runs * 1.5
    penalty += unmatched_pairs * 5
    penalty += missing_terminal * 6

    return _clamp(100 - penalty)


def _score_readability(text: str, sentences: List[str], language: str) -> float:
    effective_sentences = [sentence for sentence in sentences if not _is_heading_like(sentence)]
    if not effective_sentences:
        effective_sentences = sentences or [text]

    if language in CJK_LANGUAGES:
        return _score_cjk_readability(text, effective_sentences)

    words = _tokenize_words(text)
    if not words:
        return 0.0

    sentence_count = max(len(effective_sentences), 1)
    avg_sentence_length = len(words) / sentence_count
    avg_word_length = sum(len(word) for word in words) / len(words)
    long_sentence_ratio = sum(len(_tokenize_words(sentence)) > 28 for sentence in effective_sentences) / sentence_count

    heuristic_score = 100.0
    heuristic_score -= abs(avg_sentence_length - 18) * 2.1
    heuristic_score -= max(avg_word_length - 6.0, 0) * 12
    heuristic_score -= long_sentence_ratio * 22

    if language == "en":
        syllables = sum(_count_syllables(word, language) for word in words)
        flesch = 206.835 - (1.015 * avg_sentence_length) - (84.6 * (syllables / len(words)))
        return _clamp((flesch * 0.7) + (_clamp(heuristic_score) * 0.3))

    if language == "de":
        syllables = sum(_count_syllables(word, language) for word in words)
        flesch = 180 - avg_sentence_length - (58.5 * (syllables / len(words)))
        return _clamp((flesch * 0.7) + (_clamp(heuristic_score) * 0.3))

    return _clamp(heuristic_score)


def _score_cjk_readability(text: str, sentences: List[str]) -> float:
    units = _cjk_units(text)
    if not units:
        return 0.0

    sentence_count = max(len(sentences), 1)
    avg_sentence_units = len(units) / sentence_count
    long_sentence_ratio = sum(len(_cjk_units(sentence)) > 45 for sentence in sentences) / sentence_count

    score = 100.0
    score -= abs(avg_sentence_units - 26) * 1.8
    score -= long_sentence_ratio * 24
    return _clamp(score)


def _cjk_units(text: str) -> List[str]:
    return re.findall(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]", text)


def _count_syllables(word: str, language: str) -> int:
    normalized = re.sub(r"[^a-zA-ZäöüÄÖÜß]", "", word).lower()
    if not normalized:
        return 1

    vowels = GERMAN_VOWELS if language == "de" else LATIN_VOWELS
    groups = re.findall(rf"[{vowels}]+", normalized)
    count = len(groups)

    if language == "en":
        if normalized.endswith("e") and count > 1 and not normalized.endswith(("le", "ye")):
            count -= 1
        if normalized.endswith("es") and len(groups) > 1:
            count = max(1, count - 1)

    return max(count, 1)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, float(value)))
