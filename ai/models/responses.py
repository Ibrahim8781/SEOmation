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
