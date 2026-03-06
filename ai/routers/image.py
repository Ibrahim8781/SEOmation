from fastapi import APIRouter
from models.requests import ImageGenerateRequest
from models.responses import ImageGenerateResponse
from services.image_service import generate_images

router = APIRouter()


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(req: ImageGenerateRequest):
    # generate_images takes (prompts: List[str], platform: str, language: str)
    # Replicate the prompt `count` times for multi-image generation
    prompts = [req.prompt] * max(req.count, 1)
    platform = req.style or "blog"
    images = await generate_images(prompts, platform, req.language)
    return ImageGenerateResponse(altText=req.prompt, images=images)
