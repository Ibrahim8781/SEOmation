# ai/services/gemini_service.py - NEW FILE

"""
Google Gemini API Service
Handles all Gemini LLM interactions for high-quality content generation.
"""

import json
import logging
from typing import List, Dict
from config import settings

logger = logging.getLogger(__name__)


async def call_gemini(messages: List[Dict[str, str]], max_tokens: int = 2000, temperature: float = 0.7) -> str:
    """
    Call Gemini 2.0 Flash API with chat messages.
    
    Args:
        messages: List of {"role": "system"|"user", "content": "..."}
        max_tokens: Maximum output tokens
        temperature: Creativity (0.0-1.0)
    
    Returns:
        Generated text response
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured in .env")
    
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai not installed. Run: pip install google-generativeai")
    
    # Configure Gemini
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # Initialize model
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        generation_config={
            "max_output_tokens": max_tokens,
            "temperature": temperature,
        }
    )
    
    # Convert messages to Gemini format
    # Gemini uses a simpler format: just concatenate with role labels
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
    
    logger.info("gemini_request", extra={"prompt_length": len(prompt), "max_tokens": max_tokens})
    
    try:
        # Generate content
        response = model.generate_content(prompt)
        
        # Extract text
        result = response.text
        
        logger.info("gemini_response", extra={"response_length": len(result)})
        
        return result
        
    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        raise RuntimeError(f"Gemini generation failed: {str(e)}")


async def call_gemini_json(messages: List[Dict[str, str]], max_tokens: int = 2000, temperature: float = 0.7) -> Dict:
    """
    Call Gemini and parse JSON response.
    Adds instruction to return only valid JSON.
    """
    # Add JSON instruction to system message
    json_instruction = "\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation, just the JSON object."
    
    if messages and messages[0].get("role") == "system":
        messages[0]["content"] += json_instruction
    else:
        messages.insert(0, {"role": "system", "content": json_instruction})
    
    # Get response
    raw_response = await call_gemini(messages, max_tokens, temperature)
    
    # Clean response (remove markdown if present)
    cleaned = raw_response.strip()
    
    # Remove markdown code blocks if present
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]  # Remove ```json
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]  # Remove ```
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]  # Remove ```
    
    cleaned = cleaned.strip()
    
    # Parse JSON
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini JSON response: {e}")
        logger.error(f"Raw response: {raw_response[:500]}")
        
        # Try to extract JSON from text
        import re
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except:
                pass
        
        raise ValueError(f"Invalid JSON response from Gemini: {raw_response[:200]}")