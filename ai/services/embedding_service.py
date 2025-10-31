from typing import List
from config import settings

def embed_texts(texts: List[str]) -> List[List[float]]:
    if settings.EMBEDDER.lower() == "sbert":
        return _embed_sbert(texts)
    return _embed_cohere(texts)

def _embed_cohere(texts: List[str]) -> List[List[float]]:
    import cohere
    client = cohere.Client(api_key=settings.COHERE_API_KEY)
    resp = client.embed(texts=texts, model="embed-multilingual-v3.0", input_type="search_document")
    return resp.embeddings

def _embed_sbert(texts: List[str]) -> List[List[float]]:
    from sentence_transformers import SentenceTransformer
    model_name = settings.SBERT_MODEL
    model = SentenceTransformer(model_name)
    embs = model.encode(texts, show_progress_bar=False, convert_to_numpy=False, normalize_embeddings=True)
    return [list(map(float, v)) for v in embs]
