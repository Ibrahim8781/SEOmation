from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import topics, content, seo, image

app = FastAPI(title="SEOmation ML Service", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

app.include_router(topics.router, prefix="/topic", tags=["topic"])
app.include_router(content.router, prefix="/content", tags=["content"])
app.include_router(seo.router, prefix="/seo", tags=["seo"])
app.include_router(image.router, prefix="/image", tags=["image"])
