from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    GROQ_API_KEY: str = Field(default="")
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile")
    EMBEDDER: str = Field(default="cohere")  # cohere | sbert
    COHERE_API_KEY: str = Field(default="")
    SBERT_MODEL: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")

    VECTOR_BACKEND: str = Field(default="memory")  # qdrant | pgvector | memory
    QDRANT_URL: str = Field(default="")
    QDRANT_API_KEY: str = Field(default="")
    QDRANT_COLLECTION: str = Field(default="seom_rag")

    DATABASE_URL: str = Field(default="")
    PGVECTOR_DIM: int = Field(default=1024)

    CACHE_TTL_SECONDS: int = Field(default=21600)

    SERPER_API_KEY: str = Field(default="")
    SEARCH_SOURCES: str = Field(default="google_news,rss,serper")

    GN_HL: str = Field(default="en-PK")
    GN_GL: str = Field(default="PK")
    GN_CEID: str = Field(default="PK:en")

    UNSPLASH_ACCESS_KEY: str = Field(default="")
    PEXELS_API_KEY: str = Field(default="")

    APP_PORT: int = Field(default=8081)
    LOG_LEVEL: str = Field(default="info")
    DEFAULT_LANGUAGE: str = Field(default="en")
    DEFAULT_NAMESPACE: str = Field(default="default")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
