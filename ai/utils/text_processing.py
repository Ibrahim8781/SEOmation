import re
from typing import List

def clean_text(html_or_text: str) -> str:
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html_or_text or '')).strip()
    return text

def chunk_text(text: str, max_words: int = 120) -> List[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunks.append(' '.join(words[i:i+max_words]))
        i += max_words
    return [c for c in chunks if len(c.split()) >= 30]
