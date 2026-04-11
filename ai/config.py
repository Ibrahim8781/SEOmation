# ai/config.py - COMPLETE FILE (REPLACE ENTIRE FILE)

from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    GROQ_API_KEY: str = Field(default="")
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile")
    
    # Image Generation APIs
    IMAGE_PROVIDER_ORDER: str = Field(default="together,kie,huggingface,placeholder")
    TOGETHER_API_KEY: str = Field(default="")
    TOGETHER_IMAGE_MODEL: str = Field(default="black-forest-labs/FLUX.1-schnell")
    TOGETHER_IMAGE_STEPS: int = Field(default=4)
    TOGETHER_IMAGE_TIMEOUT_SECONDS: int = Field(default=45)

    HUGGINGFACE_API_KEY: str = Field(default="")
    HUGGINGFACE_IMAGE_MODEL: str = Field(default="black-forest-labs/FLUX.1-schnell")
    HUGGINGFACE_IMAGE_STEPS: int = Field(default=25)
    HUGGINGFACE_IMAGE_TIMEOUT_SECONDS: int = Field(default=90)

    KIE_API_KEY: str = Field(default="")
    KIE_MODEL: str = Field(default="bytedance/seedream")
    KIE_GUIDANCE_SCALE: float = Field(default=2.5)
    KIE_CREATE_TIMEOUT_SECONDS: int = Field(default=25)
    KIE_POLL_DELAY_SECONDS: int = Field(default=3)
    KIE_POLL_TIMEOUT_SECONDS: int = Field(default=120)
    KIE_POLL_REQUEST_TIMEOUT_SECONDS: int = Field(default=15)
    
    
    # Gemini configuration
    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL: str = Field(default="gemini-3.1-flash-lite-preview")  # Override in .env if you want a different Gemini text model
    
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

    # Search API Configuration
    SERPER_API_KEY: str = Field(default="")
    SERPAPI_KEY: str = Field(default="")

    GN_HL: str = Field(default="en-PK")
    GN_GL: str = Field(default="PK")
    GN_CEID: str = Field(default="PK:en")

    LOG_LEVEL: str = Field(default="info")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

