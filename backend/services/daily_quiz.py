from fastapi import APIRouter, HTTPException, Depends
from db.supabase import client as db
from db.api_keys import get_gemini_response
from dependencies.auth import verify_token
from services.queue import ai_limit
from starlette.concurrency import run_in_threadpool
import json
import random
from datetime import date, datetime, timezone


router = APIRouter()


@router.post("/generate/daily-quiz")
async def generate_daily_quiz(user=Depends(ai_limit)):
    """
    Generates a single random question from a random topic across all of the
    user's notes. No input required — fully automatic. Used by the home screen
    DailyQuiz widget only.
    """
    user_id = user["sub"]

    # 1. Check if daily quiz already generated today (before any DB/AI work)
    today_str = datetime.now(timezone.utc).date().isoformat()
    existing_daily = await run_in_threadpool(
        lambda: db.table("daily_quizzes")
        .select("id")
        .eq("user_id", user_id)
        .eq("date", today_str)
        .maybe_single()
        .execute()
    )

    if existing_daily and existing_daily.data:
        raise HTTPException(status_code=429, detail="Daily quiz already generated for today")

    # 2. Get all subjects for this user
    subjects = await run_in_threadpool(
        lambda: db.table("subjects")
        .select("id")
        .eq("user_id", user_id)
        .execute()
    )

    if not subjects.data:
        raise HTTPException(status_code=404, detail="No subjects found")

    subject_ids = [s["id"] for s in subjects.data]

    # 3. Get all topics that have at least one active note
    topics = await run_in_threadpool(
        lambda: db.table("topics")
        .select("id, notes!inner(id, status)")
        .in_("subject_id", subject_ids)
        .eq("notes.status", "active")
        .execute()
    )

    topics_with_notes = [t for t in topics.data if t.get("notes")]

    if not topics_with_notes:
        raise HTTPException(status_code=404, detail="No notes found to generate a quiz from")

    # 4. Pick a random topic
    topic = random.choice(topics_with_notes)

    # 5. Fetch notes for that topic
    notes = await run_in_threadpool(
        lambda: db.table("notes")
        .select("content, title")
        .eq("topic_id", topic["id"])
        .eq("status", "active")
        .execute()
    )

    combined = "\n\n".join([
        f"{n['title'] or 'Note'}:\n{n['content']}"
        for n in notes.data
    ])[:18000]

    prompt = f"""
    Generate exactly 1 multiple choice question from the following study notes.
    Difficulty: medium.

    Rules:
    - Exactly 4 options labeled A, B, C, D
    - Only one correct answer
    - Include a brief explanation for the correct answer
    - Base the question ONLY on the provided notes

    Return ONLY a valid JSON object, no extra text, no markdown, no backticks:
    {{
      "question": "question text",
      "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4"}},
      "correct": "A",
      "explanation": "why A is correct"
    }}

    Study Notes:
    {combined}
    """

    response = await run_in_threadpool(get_gemini_response, prompt)
    try:
        if hasattr(response, "text"):
            text = response.text
        else:
            text = response.choices[0].message.content
        text = text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        question = json.loads(text)
    except (json.JSONDecodeError, KeyError, IndexError, AttributeError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse quiz response from AI: {e}")

    # 6. Save to quizzes table and return quiz_id for the client to store in daily_quizzes
    saved = await run_in_threadpool(
        lambda: db.table("quizzes").insert({
            "topic_id": topic["id"],
            "title": "Daily Quiz",
            "questions": [question],
        }).execute()
    )

    quiz_id = saved.data[0]["id"]

    return {
        "quiz_id": quiz_id,
        "question": question,
    }
