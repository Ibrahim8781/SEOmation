from fastapi import APIRouter
from models.requests import ImageGenerateRequest
from models.responses import ImageGenerateResponse
from services.image_generation_service import generate_images

router = APIRouter()


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(req: ImageGenerateRequest):
    requested_sizes = list(req.sizes or [])
    image_count = max(req.count, len(requested_sizes), 1)
    prompts = [req.prompt] * image_count
    platform = req.platform or req.style or "blog"
    images = await generate_images(
        prompts,
        platform=platform,
        language=req.language,
        sizes=requested_sizes,
    )
    return ImageGenerateResponse(altText=req.prompt, images=images)
