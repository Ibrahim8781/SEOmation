from pydantic import BaseModel, Field
from typing import List, Optional

TOPIC_SUGGESTION_COUNT = 6

class Persona(BaseModel):
    role: str = Field(min_length=2)
    pains: List[str] = []

class TopicSuggestRequest(BaseModel):
    userId: str
    language: str = "en"
    niche: str
    persona: Persona
    seedKeywords: List[str] = []
    region: Optional[str] = None
    season: Optional[str] = None
    contentGoals: Optional[str] = None
    preferredContentTypes: List[str] = []
    count: int = Field(default=TOPIC_SUGGESTION_COUNT, ge=1, le=TOPIC_SUGGESTION_COUNT)
    includeTrends: bool = True
    namespace: Optional[str] = None

class ContentGenerateRequest(BaseModel):
    userId: str
    platform: str  # blog | linkedin | instagram
    language: str = "en"
    topicOrIdea: str = Field(min_length=4, max_length=4000)
    tone: str = "friendly"
    targetLength: int = 1200
    focusKeyword: str = Field(min_length=2)
    includeTrend: bool = True
    styleGuideBullets: List[str] = []
    niche: Optional[str] = None
    seedKeywords: List[str] = []
    region: Optional[str] = None
    season: Optional[str] = None
    persona: Optional[Persona] = None
    namespace: Optional[str] = None

class ImageGenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1000)
    platform: Optional[str] = None
    style: Optional[str] = None
    sizes: List[str] = []
    count: int = Field(default=1, ge=1, le=6)
    language: str = "en"
