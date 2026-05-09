from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional, List, Literal
from starlette.concurrency import run_in_threadpool
from datetime import datetime, timezone, timedelta
from services.queue import ai_limit
from db.supabase import client as supabase
from db.api_keys import get_gemini_response, get_groq_response
from dependencies.auth import verify_token
from services.prompts import build_chat_system_prompt
from services.context import get_chat_notes_context, get_mistakes_context, get_chat_history

router = APIRouter()


def estimate_tokens(text: str) -> int:
    return int(len(text.split()) * 1.3)


class StartSessionRequest(BaseModel):
    note_ids: List[str]
    mode: Literal["explain", "quiz", "socratic"] = "explain"

    @field_validator('note_ids')
    @classmethod
    def limit_note_ids(cls, v):
        if len(v) > 20:
            raise ValueError('Max 20 notes per session')
        return v


class ChatRequest(BaseModel):
    session_id: str
    message: str
    image_base64: Optional[str] = None

    @field_validator('message')
    @classmethod
    def limit_message(cls, v):
        if len(v) > 10000:
            raise ValueError('Message too long, max 10,000 characters')
        return v


@router.post("/chat/session")
async def start_session(data: StartSessionRequest, user=Depends(verify_token)):
    if data.note_ids:
        owned = await run_in_threadpool(
            lambda: supabase.table("notes")
            .select("id, topics(subjects(user_id))")
            .in_("id", data.note_ids)
            .execute()
        )
        not_owned = [
            n["id"] for n in owned.data
            if n["topics"]["subjects"]["user_id"] != user["sub"]
        ]
        if not_owned:
            raise HTTPException(status_code=403, detail="Access denied to one or more notes")

    session = await run_in_threadpool(
        lambda: supabase.table("chat_sessions").insert({
            "user_id": user["sub"],
            "mode": data.mode,
            "title": "New Chat"
        }).execute()
    )
    session_id = session.data[0]["id"]

    if data.note_ids:
        await run_in_threadpool(
            lambda: supabase.table("session_notes").insert([
                {"session_id": session_id, "note_id": note_id}
                for note_id in data.note_ids
            ]).execute()
        )

    return {"session_id": session_id}


@router.post("/chat/message")
async def send_message(data: ChatRequest, user=Depends(ai_limit)):
    session = await run_in_threadpool(
        lambda: supabase.table("chat_sessions")
        .select("mode, user_id")
        .eq("id", data.session_id)
        .maybe_single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.data["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    mode = session.data["mode"]

    notes_context   = await get_chat_notes_context(data.session_id)
    mistakes_context = await get_mistakes_context(user["sub"])
    history         = await get_chat_history(data.session_id)

    system_prompt = build_chat_system_prompt(mode, notes_context, mistakes_context)

    messages = history + [{"role": "user", "content": data.message}]

    if estimate_tokens(notes_context + system_prompt + str(messages)) > 800_000:
        raise HTTPException(
            status_code=400,
            detail="Context too large. Please remove some notes from this session to continue chatting."
        )

    await run_in_threadpool(
        lambda: supabase.table("chat_messages").insert({
            "session_id": data.session_id,
            "user_id": user["sub"],
            "role": "user",
            "content": data.message,
        }).execute()
    )

    if len(history) == 0:
        await run_in_threadpool(
            lambda: supabase.table("chat_sessions")
            .update({"title": data.message[:50]})
            .eq("id", data.session_id)
            .execute()
        )

    if data.image_base64:
        prompt = system_prompt + "\n\nStudent's message: " + data.message
        response = await run_in_threadpool(
            get_gemini_response, prompt, "gemini-2.0-flash", data.image_base64
        )
        full_reply = response.text
    else:
        groq_messages = [{"role": "system", "content": system_prompt}] + messages
        response = await run_in_threadpool(get_groq_response, groq_messages)
        full_reply = response.choices[0].message.content

    await run_in_threadpool(
        lambda: supabase.table("chat_messages").insert({
            "session_id": data.session_id,
            "user_id": user["sub"],
            "role": "assistant",
            "content": full_reply,
        }).execute()
    )

    return {"reply": full_reply, "session_id": data.session_id}


@router.patch("/chat/session/{session_id}/mode")
async def update_session_mode(session_id: str, data: dict, user=Depends(verify_token)):
    mode = data.get("mode")
    if mode not in ("explain", "quiz", "socratic"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    session = await run_in_threadpool(
        lambda: supabase.table("chat_sessions")
        .select("user_id")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    if not session.data or session.data["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await run_in_threadpool(
        lambda: supabase.table("chat_sessions")
        .update({"mode": mode})
        .eq("id", session_id)
        .execute()
    )
    return {"mode": mode}


@router.get("/chat/history/{session_id}")
async def get_history(session_id: str, user=Depends(verify_token)):
    session = await run_in_threadpool(
        lambda: supabase.table("chat_sessions")
        .select("user_id")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    if not session.data or session.data["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await run_in_threadpool(
        lambda: supabase.table("chat_messages")
        .select("role, content, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return {"messages": result.data}


@router.get("/chat/sessions")
async def get_sessions(user=Depends(verify_token)):
    result = await run_in_threadpool(
        lambda: supabase.table("chat_sessions")
        .select("id, title, mode, created_at")
        .eq("user_id", user["sub"])
        .order("created_at", desc=True)
        .execute()
    )
    return {"sessions": result.data}
