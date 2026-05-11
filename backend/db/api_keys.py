import logging
import os
import time
import itertools
import threading
from typing import Union, Optional, Tuple
from google import genai
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Key pools

GEMINI_KEYS = [
    k for k in [
        os.getenv("GEMINI_API_KEY_1"),
        os.getenv("GEMINI_API_KEY_2"),
        os.getenv("GEMINI_API_KEY_3"),
        os.getenv("GEMINI_API_KEY_4"),
        os.getenv("GEMINI_API_KEY_5"),
    ] if k
]

GROQ_KEYS = [
    k for k in [
        os.getenv("GROQ_API_KEY_1"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_3"),
    ] if k
]

if not GEMINI_KEYS:
    logger.warning("No Gemini API keys found")
if not GROQ_KEYS:
    logger.warning("No Groq API keys found")

# ── Round-robin counters (thread-safe) 
_gemini_cycle = itertools.cycle(range(len(GEMINI_KEYS))) if GEMINI_KEYS else None
_groq_cycle = itertools.cycle(range(len(GROQ_KEYS))) if GROQ_KEYS else None
_key_lock = threading.Lock()

def _next_gemini_key() -> Tuple[str, int]:
    with _key_lock:
        idx = next(_gemini_cycle)
    return GEMINI_KEYS[idx], idx

def _next_groq_key() -> Tuple[str, int]:
    with _key_lock:
        idx = next(_groq_cycle)
    return GROQ_KEYS[idx], idx

# ── Error classification

RETRYABLE_ERRORS = ("429", "503", "UNAVAILABLE", "quota", "overloaded", "high demand", "rate limit")

def _is_retryable(error: Exception) -> bool:
    return any(code in str(error) for code in RETRYABLE_ERRORS)

# ── Retry config

RETRY_DELAYS = [5, 10, 20]

# ── Core providers

def _try_gemini(prompt: str, model: str, image_base64: Optional[str] = None):
    if not GEMINI_KEYS:
        raise RuntimeError("No Gemini API keys configured")
    last_error = None
    for i in range(len(GEMINI_KEYS)):
        key, idx = _next_gemini_key()
        try:
            client = genai.Client(api_key=key)
            if image_base64:
                contents = [{"role": "user", "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}}
                ]}]
            else:
                contents = prompt
            response = client.models.generate_content(model=model, contents=contents)
            return response
        except Exception as e:
            last_error = e
            if _is_retryable(e):
                logger.warning(f"Gemini key {idx + 1} → retryable error: {e}")
                continue
            else:
                logger.error(f"Gemini key {idx + 1} → non-retryable error: {e}")
                raise e

    logger.error(f"All Gemini keys exhausted. Last error: {last_error}")
    raise last_error or RuntimeError("All Gemini keys exhausted with no error captured")


def _try_groq(prompt: Union[str, list], model: str = "llama-3.3-70b-versatile"):
    if not GROQ_KEYS:
        raise RuntimeError("No Groq API keys configured")
    last_error = None
    messages = prompt if isinstance(prompt, list) else [{"role": "user", "content": prompt}]

    for i in range(len(GROQ_KEYS)):
        key, idx = _next_groq_key()
        try:
            client = Groq(api_key=key)
            response = client.chat.completions.create(model=model, messages=messages)
            return response
        except Exception as e:
            last_error = e
            if _is_retryable(e):
                logger.warning(f"Groq key {idx + 1} → retryable error: {e}")
                continue
            else:
                logger.error(f"Groq key {idx + 1} → non-retryable error: {e}")
                raise e

    logger.error(f"All Groq keys exhausted. Last error: {last_error}")
    raise last_error or RuntimeError("All Groq keys exhausted with no error captured")

# ── Public API 
def get_gemini_response(
    prompt: str,
    model: str = "gemini-2.5-flash",
    image_base64: Optional[str] = None,
    system_prompt: Optional[str] = None,
):
    from fastapi import HTTPException

    last_error = None

    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay > 0:
            logger.info(f"All providers exhausted. Retry {attempt}/{len(RETRY_DELAYS)} in {delay}s...")
            time.sleep(delay)

        try:
            response = _try_gemini(prompt, model, image_base64)
            if attempt > 0:
                logger.info(f"Gemini recovered on retry {attempt}")
            return response
        except Exception as e:
            last_error = e
            logger.error(f"Gemini pool failed: {e}")

        if image_base64:
            logger.info("Image request — no Groq fallback available")
            break

        try:
            # Build proper messages list so system prompt isn't lost on fallback
            groq_messages = []
            if system_prompt:
                groq_messages.append({"role": "system", "content": system_prompt})
            groq_messages.append({"role": "user", "content": prompt})

            response = _try_groq(groq_messages)
            if attempt > 0:
                logger.info(f"Groq recovered on retry {attempt}")
            return response
        except Exception as e:
            last_error = e
            logger.error(f"Groq pool also failed: {e}")

    logger.critical(f"All AI providers failed after {len(RETRY_DELAYS)} retries. Last error: {last_error}")
    raise HTTPException(
        status_code=503,
        detail="AI service is temporarily unavailable due to high demand. Please try again in a few minutes."
    )


def get_gemini_notes(prompt: str, model: str = "gemini-2.5-flash", system_prompt: Optional[str] = None) -> str:
    response = get_gemini_response(prompt, model, system_prompt=system_prompt)
    return response.text if hasattr(response, "text") else response.choices[0].message.content


def get_groq_response(messages: list, model: str = "llama-3.3-70b-versatile"):
    from fastapi import HTTPException

    last_error = None

    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay > 0:
            logger.info(f"Groq retry {attempt}/{len(RETRY_DELAYS)} in {delay}s...")
            time.sleep(delay)

        try:
            return _try_groq(messages)
        except Exception as e:
            last_error = e

    logger.critical(f"All Groq keys failed after retries. Last error: {last_error}")
    raise HTTPException(
        status_code=503,
        detail="AI service is temporarily unavailable. Please try again in a few minutes."
    )
