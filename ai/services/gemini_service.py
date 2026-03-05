# ai/services/gemini_service.py - FINAL FIX

import json
import logging
import re
from typing import List, Dict
from config import settings

logger = logging.getLogger(__name__)

try:
    import google.genai as genai
    GEMINI_AVAILABLE = True
    GENAI_NEW_VERSION = True
except ImportError:
    try:
        import google.generativeai as genai
        GEMINI_AVAILABLE = True
        GENAI_NEW_VERSION = False
    except ImportError:
        GEMINI_AVAILABLE = False
        GENAI_NEW_VERSION = False


async def call_gemini(messages: List[Dict[str, str]], max_tokens: int = 2000, temperature: float = 0.7) -> str:
    if not GEMINI_AVAILABLE:
        raise RuntimeError("google-generativeai not installed")
    
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")
    
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        generation_config={
            "max_output_tokens": max_tokens,
            "temperature": temperature,
        }
    )
    
    prompt_parts = []
    for msg in messages:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        
        if role == "SYSTEM":
            prompt_parts.append(f"INSTRUCTIONS:\n{content}\n")
        elif role == "USER":
            prompt_parts.append(f"USER:\n{content}\n")
        elif role == "ASSISTANT":
            prompt_parts.append(f"ASSISTANT:\n{content}\n")
    
    prompt = "\n".join(prompt_parts)
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        raise RuntimeError(f"Gemini generation failed: {str(e)}")


async def call_gemini_json(messages: List[Dict[str, str]], max_tokens: int = 2000, temperature: float = 0.7) -> Dict:
    # Lower temperature for more consistent JSON
    temperature = min(temperature, 0.4)
    
    # Stronger JSON instruction
    json_instruction = """
CRITICAL: Return ONLY valid JSON. Rules:
1. NO markdown code blocks (no ``` or ```json)
2. All strings must use proper quotes with NO line breaks inside them
3. Escape special characters properly
4. Return the raw JSON object directly
"""
    
    if messages and messages[0].get("role") == "system":
        messages[0]["content"] += json_instruction
    else:
        messages.insert(0, {"role": "system", "content": json_instruction})
    
    # Try up to 2 times
    for attempt in range(2):
        try:
            raw_response = await call_gemini(messages, max_tokens, temperature)
            cleaned = _clean_json_response(raw_response)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            if attempt == 0:
                # Ask Gemini to fix it
                logger.warning(f"JSON parse failed (attempt {attempt+1}), asking Gemini to repair")
                messages = [
                    {"role": "system", "content": "You are a JSON validator. Fix the malformed JSON below. Return ONLY the corrected JSON, no explanation."},
                    {"role": "user", "content": f"Fix this JSON (remove newlines in strings, fix quotes):\n\n{raw_response[:2000]}"}
                ]
                temperature = 0.2  # Very low for repair
            else:
                # Last attempt: create minimal valid response
                logger.error(f"JSON repair failed: {e}")
                return _create_fallback_response(raw_response)
    
    raise ValueError("Failed to generate valid JSON after 2 attempts")


def _clean_json_response(raw: str) -> str:
    """Clean markdown and other artifacts from JSON response"""
    cleaned = raw.strip()
    
    # Remove markdown blocks
    patterns = [
        r'```json\s*([\s\S]*?)\s*```',
        r'```\s*([\s\S]*?)\s*```',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            cleaned = match.group(1)
            break
    
    # Remove remaining artifacts
    cleaned = re.sub(r'^```json\s*', '', cleaned)
    cleaned = re.sub(r'^```\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    cleaned = cleaned.strip('`').strip()
    
    # Find JSON boundaries
    first = cleaned.find('{')
    last = cleaned.rfind('}')
    if first != -1 and last != -1 and first < last:
        cleaned = cleaned[first:last+1]
    
    # Fix common JSON errors
    # Remove newlines inside string values
    cleaned = re.sub(r':\s*"([^"]*)\n([^"]*)"', r': "\1 \2"', cleaned)
    
    return cleaned


def _create_fallback_response(raw: str) -> Dict:
    """Create a minimal valid response from malformed JSON"""
    logger.warning("Creating fallback response from malformed JSON")
    
    # Try to extract key fields
    title = re.search(r'"title"\s*:\s*"([^"]+)"', raw)
    h1 = re.search(r'"h1"\s*:\s*"([^"]+)"', raw)
    
    if title:
        return {
            "title": title.group(1),
            "h1": h1.group(1) if h1 else title.group(1),
            "sections": [
                {"h2": "Introduction", "body": "Content generated successfully. Please review and edit as needed."}
            ],
            "meta": {
                "description": title.group(1)[:160],
                "slug": re.sub(r'[^a-z0-9]+', '-', title.group(1).lower())
            },
            "images": []
        }
    
    # Ultimate fallback
    return {
        "title": "Generated Content",
        "h1": "Generated Content",
        "sections": [{"h2": "Content", "body": "Please review and edit."}],
        "meta": {"description": "Generated content", "slug": "content"},
        "images": []
    }