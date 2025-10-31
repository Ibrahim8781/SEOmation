from pydantic import BaseModel, Field
from typing import List, Optional

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
    count: int = Field(default=12, ge=5, le=40)
    includeTrends: bool = True
    namespace: Optional[str] = None

class ContentGenerateRequest(BaseModel):
    userId: str
    platform: str  # blog | linkedin | instagram
    language: str = "en"
    topicOrIdea: str = Field(min_length=4)
    tone: str = "friendly"
    targetLength: int = 1200
    focusKeyword: str = Field(min_length=2)
    includeTrend: bool = True
    styleGuideBullets: List[str] = []
    namespace: Optional[str] = None

class SeoHintRequest(BaseModel):
    platform: str
    language: str
    focusKeyword: str
    content: str
