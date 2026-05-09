from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import List
from starlette.concurrency import run_in_threadpool
from db.supabase import client as db
from services.queue import ai_limit
from db.api_keys import get_gemini_response
from services.prompts import build_flashcard_prompt
from services.context import get_notes_context
import json

router = APIRouter()


class FlashcardRequest(BaseModel):
    topic_ids: List[str]
    num_cards: int = 10

    @field_validator('num_cards')
    @classmethod
    def cap_num_cards(cls, v):
        if v < 1:
            raise ValueError('num_cards must be at least 1')
        if v > 50:
            raise ValueError('num_cards max is 50')
        return v


@router.post("/generate/flashcards")
async def generate_flashcards(data: FlashcardRequest, user=Depends(ai_limit)):
    notes_context = await get_notes_context(data.topic_ids, user["sub"])

    prompt = build_flashcard_prompt(notes_context, data.num_cards)
    response = await run_in_threadpool(get_gemini_response, prompt)

    try:
        text = response.text if hasattr(response, "text") else response.choices[0].message.content
        text = text.strip().replace("```json", "").replace("```", "").strip()
        cards = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse flashcard response from AI")

    clean_cards = [c for c in cards if "front" in c and "back" in c]
    rows = [
        {"topic_id": tid, "front": c["front"], "back": c["back"]}
        for tid in data.topic_ids
        for c in clean_cards
    ]
    await run_in_threadpool(
        lambda: db.table("flashcards").insert(rows).execute()
    )

    return {"flashcards": cards, "total": len(cards)}
