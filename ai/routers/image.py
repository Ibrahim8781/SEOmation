from fastapi import APIRouter
from models.requests import ImageGenerateRequest
from models.responses import ImageGenerateResponse
from services.image_service import generate_images

router = APIRouter()


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(req: ImageGenerateRequest):
    result = await generate_images(req.prompt, req.style, req.sizes, req.count, req.language)
    return ImageGenerateResponse(**result)
