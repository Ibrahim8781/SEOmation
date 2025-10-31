from fastapi import APIRouter
from models.requests import SeoHintRequest
from models.responses import SeoHintResponse
from services.quality_checker import seo_score_and_hints

router = APIRouter()

@router.post("/hints", response_model=SeoHintResponse)
def seo_hints(req: SeoHintRequest):
    score, hints = seo_score_and_hints(req.platform, req.language, req.focusKeyword, req.content)
    return SeoHintResponse(score=score, hints=hints)
