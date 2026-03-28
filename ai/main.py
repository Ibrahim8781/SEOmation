from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from routers import topics, content, image
from config import settings


def configure_logging():
    level_name = str(settings.LOG_LEVEL or os.getenv("LOG_LEVEL", "INFO")).upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(levelname)s:%(name)s:%(message)s",
        force=True,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)


configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="SEOmation ML Service", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}


@app.on_event("startup")
async def log_startup_configuration():
    logger.info(
        "AI service startup log_level=%s gemini_model=%s image_provider_order=%s",
        settings.LOG_LEVEL,
        settings.GEMINI_MODEL,
        settings.IMAGE_PROVIDER_ORDER,
    )

app.include_router(topics.router, prefix="/topic", tags=["topic"])
app.include_router(content.router, prefix="/content", tags=["content"])
app.include_router(image.router, prefix="/image", tags=["image"])
