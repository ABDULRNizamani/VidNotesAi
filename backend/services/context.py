"""
Async DB helpers that assemble the data each route needs before calling AI.
Routes call these, then pass the results straight to prompts.py.
"""

from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from db.supabase import client as supabase

NOTES_CHAR_LIMIT = 15_000   # matches CLAUDE.md cap for all AI context
CHAT_CHAR_LIMIT  = 80_000   # chatbot gets more room — multi-note sessions


# ─────────────────────────────────────────────────────────────────────────────
# NOTES CONTEXT
# ─────────────────────────────────────────────────────────────────────────────

async def get_notes_context(
    topic_ids: list[str],
    user_id: str,
    char_limit: int = NOTES_CHAR_LIMIT,
) -> str:
    """
    Verify ownership of all topic_ids, fetch their active notes,
    and return a single combined string ready to drop into a prompt.
    Raises 403 if any topic is not owned by user_id.
    Raises 404 if no active notes exist.
    """
    ownership = await run_in_threadpool(
        lambda: supabase.table("topics")
        .select("id, subjects(user_id)")
        .in_("id", topic_ids)
        .execute()
    )
    accessible = [
        t for t in ownership.data
        if t.get("subjects", {}).get("user_id") == user_id
    ]
    if len(accessible) != len(topic_ids):
        raise HTTPException(status_code=403, detail="Access denied to one or more topics")

    result = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("content, title")
        .in_("topic_id", topic_ids)
        .eq("status", "active")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No active notes found for selected topics")

    combined = "\n\n".join(
        f"{n['title'] or 'Note'}:\n{n['content']}"
        for n in result.data
    )
    return combined[:char_limit]


async def get_topic_notes_context(
    topic_id: str,
    user_id: str,
    char_limit: int = NOTES_CHAR_LIMIT,
) -> str:
    """
    Single-topic variant — verifies ownership via subjects join,
    returns combined active note content.
    """
    topic = await run_in_threadpool(
        lambda: supabase.table("topics")
        .select("subjects(user_id)")
        .eq("id", topic_id)
        .maybe_single()
        .execute()
    )
    if not topic.data or topic.data["subjects"]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="You don't own that topic")

    notes = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("content, title")
        .eq("topic_id", topic_id)
        .eq("status", "active")
        .execute()
    )
    if not notes.data:
        raise HTTPException(status_code=404, detail="No active notes found for this topic")

    combined = "\n\n".join(
        f"{n['title'] or 'Note'}:\n{n['content']}"
        for n in notes.data
    )
    return combined[:char_limit]


# ─────────────────────────────────────────────────────────────────────────────
# CHAT CONTEXT
# ─────────────────────────────────────────────────────────────────────────────

async def get_chat_notes_context(
    session_id: str,
    char_limit: int = CHAT_CHAR_LIMIT,
) -> str:
    """
    Fetch all notes linked to a chat session and return them as a combined string.
    Caller must verify session ownership before calling this.
    """
    session_notes = await run_in_threadpool(
        lambda: supabase.table("session_notes")
        .select("note_id")
        .eq("session_id", session_id)
        .execute()
    )
    note_ids = [n["note_id"] for n in session_notes.data]
    if not note_ids:
        return ""

    notes = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("title, content")
        .in_("id", note_ids)
        .execute()
    )
    combined = "\n\n".join(
        f"{n['title'] or 'Note'}:\n{n['content']}"
        for n in notes.data
    )
    return combined[:char_limit]


async def get_mistakes_context(
    user_id: str,
    lookback_weeks: int = 2,
) -> str:
    """
    Fetch recent wrong answers for a user and return a formatted string
    for injection into the chat system prompt.
    Returns empty string if none found.
    """
    since = (datetime.now(timezone.utc) - timedelta(weeks=lookback_weeks)).isoformat()

    mistakes = await run_in_threadpool(
        lambda: supabase.table("quiz_attempts")
        .select("wrong_answers")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    all_wrong = [
        str(a["wrong_answers"])
        for a in mistakes.data
        if a.get("wrong_answers")
    ]
    return "\n".join(all_wrong) if all_wrong else ""


async def get_chat_history(session_id: str) -> list[dict]:
    """
    Return ordered chat history for a session as a list of
    {role, content} dicts ready to pass to the AI.
    """
    result = await run_in_threadpool(
        lambda: supabase.table("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return [{"role": m["role"], "content": m["content"]} for m in result.data]


# ─────────────────────────────────────────────────────────────────────────────
# WEEKLY SUMMARY CONTEXT
# ─────────────────────────────────────────────────────────────────────────────

async def get_weekly_attempts(since_iso: str) -> dict[str, list[dict]]:
    """
    Fetch all quiz attempts since `since_iso`, group by user_id,
    and unwrap nested relations.
    Returns {user_id: [attempt, ...]}
    """
    attempts_raw = await run_in_threadpool(
        lambda: supabase.table("quiz_attempts")
        .select(
            "user_id, score, total, wrong_answers, created_at, "
            "quizzes(topic_id, topics(name, subjects(name)))"
        )
        .gte("created_at", since_iso)
        .execute()
    )

    user_attempts: dict[str, list[dict]] = {}
    for a in attempts_raw.data:
        uid = a.get("user_id")
        if not uid:
            continue
        quizzes  = a.get("quizzes") or {}
        topics   = quizzes.get("topics") or {}
        subjects = topics.get("subjects") or {}

        user_attempts.setdefault(uid, []).append({
            "score":         a.get("score", 0),
            "total":         a.get("total", 0),
            "wrong_answers": a.get("wrong_answers") or [],
            "topic_name":    topics.get("name") or "Unknown",
            "subject_name":  subjects.get("name") or "",
        })

    return user_attempts


async def get_already_summarised_users(
    week_start: str,
    user_ids: list[str],
) -> set[str]:
    """
    Return the set of user_ids who already have a weekly summary
    for the given week_start date string.
    """
    existing = await run_in_threadpool(
        lambda: supabase.table("weekly_summaries")
        .select("user_id")
        .eq("week_start", week_start)
        .in_("user_id", user_ids)
        .execute()
    )
    return {r["user_id"] for r in existing.data}
