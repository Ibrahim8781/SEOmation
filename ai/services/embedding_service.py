from typing import List
from config import settings
import logging

logger = logging.getLogger(__name__)

def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Batch all embeddings in ONE call for optimal performance.
    Handles large batches by splitting into API-compliant chunks.
    """
    if not texts:
        return []
    
    # Cohere trial allows 100 requests/min
    # Batch in groups of 96 to stay under limit
    BATCH_SIZE = 96
    all_embeddings = []
    
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        
        if settings.EMBEDDER.lower() == "sbert":
            embeddings = _embed_sbert(batch)
        else:
            embeddings = _embed_cohere(batch)
        
        all_embeddings.extend(embeddings)
    
    logger.info("embed_texts", extra={"total_texts": len(texts), "batches": (len(texts) + BATCH_SIZE - 1) // BATCH_SIZE})
    return all_embeddings

def _embed_cohere(texts: List[str]) -> List[List[float]]:
    import cohere
    client = cohere.Client(api_key=settings.COHERE_API_KEY)
    resp = client.embed(texts=texts, model="embed-multilingual-v3.0", input_type="search_document")
    return resp.embeddings

def _embed_sbert(texts: List[str]) -> List[List[float]]:
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "sentence-transformers is required when EMBEDDER=sbert. "
            "Install it explicitly or use the default Cohere embedder."
        ) from exc
    model_name = settings.SBERT_MODEL
    model = SentenceTransformer(model_name)
    embs = model.encode(texts, show_progress_bar=False, convert_to_numpy=False, normalize_embeddings=True)
    return [list(map(float, v)) for v in embs]
