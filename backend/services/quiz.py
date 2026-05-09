from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Literal
from starlette.concurrency import run_in_threadpool
from db.supabase import client as db
from db.api_keys import get_gemini_response
from services.queue import ai_limit
from services.prompts import build_quiz_prompt
from services.context import get_notes_context
import json

router = APIRouter()


class QuizRequest(BaseModel):
    topic_ids: List[str]
    num_questions: int = Field(default=10, ge=1, le=30)
    difficulty: Literal["easy", "medium", "hard"] = "medium"


@router.post("/generate/quiz")
async def generate_quiz(data: QuizRequest, user=Depends(ai_limit)):
    notes_context = await get_notes_context(data.topic_ids, user["sub"])

    prompt = build_quiz_prompt(notes_context, data.num_questions, data.difficulty)
    response = await run_in_threadpool(get_gemini_response, prompt)

    try:
        text = response.text if hasattr(response, "text") else response.choices[0].message.content
        text = text.strip().replace("```json", "").replace("```", "").strip()
        questions = json.loads(text)

        saved = await run_in_threadpool(
            lambda: db.table("quizzes").insert({
                "topic_id": data.topic_ids[0],
                "title": "Quiz",
                "questions": questions,
            }).execute()
        )

        return {"quiz_id": saved.data[0]["id"], "questions": questions, "total": len(questions)}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse quiz response from AI")
