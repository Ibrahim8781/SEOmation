from pydantic import BaseModel
from typing import List, Dict, Any

class TopicCluster(BaseModel):
    label: str
    ideas: List[Dict[str, Any]]

class TopicSuggestResponse(BaseModel):
    clusters: List[TopicCluster]
    ideas: List[Dict[str, Any]]
    diagnostics: Dict[str, Any]

class ContentGenerateResponse(BaseModel):
    contentForEditor: Dict[str, Any]  # includes html + plain for all platforms
    diagnostics: Dict[str, Any]

class SeoHintResponse(BaseModel):
    score: int
    hints: List[Dict[str, str]]

class GeneratedImage(BaseModel):
    url: str
    base64: str
    size: str
    provider: str
    altText: str

class ImageGenerateResponse(BaseModel):
    altText: str
    images: List[GeneratedImage]
