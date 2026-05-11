import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import httpx
import os
from starlette.concurrency import run_in_threadpool
from urllib.parse import urlparse, parse_qs
from db.supabase import client as supabase
from dependencies.auth import verify_token, verify_token_optional
from dependencies.guest import get_guest_remaining, GUEST_NOTE_LIMIT
from services.queue import _check_rate_limit
from services.chunkers import generate_notes_chunked

logger = logging.getLogger(__name__)

router = APIRouter()

SUPADATA_API_KEY = os.getenv("SUPADATA_API_KEY")


class GenerateNotesRequest(BaseModel):
    url: str = Field(..., max_length=500)
    topic_id: Optional[str] = None
    title: Optional[str] = None

    @field_validator('title')
    @classmethod
    def limit_title(cls, v):
        if v and len(v) > 200:
            raise ValueError('title too long, max 200 chars')
        return v


class GenerateNotesFromTextRequest(BaseModel):
    topic_id: str
    title: Optional[str] = None
    source_text: str

    @field_validator('source_text')
    @classmethod
    def limit_source_text(cls, v):
        if len(v) > 200_000:
            raise ValueError('source_text too large, max 200KB')
        return v


@router.post("/generate/notes/from-text")
async def generate_notes_from_text(
    data: GenerateNotesFromTextRequest,
    user=Depends(verify_token),
):
    _check_rate_limit(user["sub"])

    topic = await run_in_threadpool(
        lambda: supabase.table("topics")
        .select("subjects(user_id)")
        .eq("id", data.topic_id)
        .maybe_single()
        .execute()
    )
    if not topic.data or topic.data["subjects"]["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="You don't own that topic")

    existing_count = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("id", count="exact")
        .eq("topic_id", data.topic_id)
        .eq("status", "active")
        .execute()
    )
    if existing_count.count >= 7:
        raise HTTPException(status_code=400, detail="Max 7 notes per topic reached")

    full_content = await generate_notes_chunked(data.source_text)

    title = data.title or "Untitled Note"
    await run_in_threadpool(
        lambda: supabase.table("notes").insert({
            "topic_id": data.topic_id,
            "source_id": None,
            "title": title,
            "content": full_content,
            "status": "active",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
        }).execute()
    )
    return {"content": full_content, "title": title}


def extract_video_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.hostname == "youtu.be":
        return parsed.path[1:]
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        if parsed.path == "/watch":
            params = parse_qs(parsed.query)
            if "v" not in params:
                raise HTTPException(status_code=400, detail="Invalid YouTube URL")
            return params["v"][0]
        if parsed.path.startswith("/shorts/"):
            return parsed.path.split("/")[2]
    raise HTTPException(status_code=400, detail="Invalid YouTube URL")


async def get_youtube_title(video_id: str) -> str:
    """Fetch video title via oEmbed — no API key needed."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.youtube.com/oembed",
                params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
                timeout=8,
            )
        if resp.status_code == 200:
            return resp.json().get("title", "").strip()
    except Exception:
        pass
    return ""


async def get_english_transcript(video_id: str) -> str:
    if not SUPADATA_API_KEY:
        raise HTTPException(status_code=503, detail="Transcript service not configured")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.supadata.ai/v1/youtube/transcript",
                params={"videoId": video_id, "lang": "en"},
                headers={"x-api-key": SUPADATA_API_KEY},
                timeout=30,
            )
    except Exception as e:
        logger.error(f"Supadata request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcript fetch failed: {str(e)}")

    logger.info(f"Supadata response status: {resp.status_code}")

    if resp.status_code == 404:
        raise HTTPException(status_code=422, detail="No transcript found for this video")
    if resp.status_code == 403:
        raise HTTPException(status_code=422, detail="Transcripts are disabled for this video")
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Could not fetch transcript")

    data = resp.json()
    content = data.get("content", [])

    if not content:
        raise HTTPException(status_code=422, detail="No transcript content returned")

    transcript = " ".join([chunk["text"].replace("\n", " ") for chunk in content if chunk.get("text")])
    logger.info(f"Got transcript: {len(transcript)} chars")
    return transcript


@router.post("/generate/notes")
async def generate_notes(
    data: GenerateNotesRequest,
    user=Depends(verify_token_optional),
    x_device_id: str = Header(default=None, alias="X-Device-ID"),
):
    is_guest = user is None

    if not is_guest:
        _check_rate_limit(user["sub"])

    if is_guest:
        if not x_device_id:
            raise HTTPException(status_code=400, detail="X-Device-ID header required for guest access")
        slot = await run_in_threadpool(
            lambda: supabase.rpc("check_and_reserve_guest_slot", {
                "p_device_id": x_device_id, "p_limit": GUEST_NOTE_LIMIT
            }).execute()
        )
        if slot.data is False:
            raise HTTPException(status_code=403, detail="guest_limit_reached")

    source_id = None
    if not is_guest:
        if not data.topic_id:
            raise HTTPException(status_code=400, detail="topic_id is required for authenticated users")

        topic = await run_in_threadpool(
            lambda: supabase.table("topics")
            .select("subjects(user_id)")
            .eq("id", data.topic_id)
            .maybe_single()
            .execute()
        )
        if not topic.data or topic.data["subjects"]["user_id"] != user["sub"]:
            raise HTTPException(status_code=403, detail="You don't own that topic")

        existing_count = await run_in_threadpool(
            lambda: supabase.table("notes")
            .select("id", count="exact")
            .eq("topic_id", data.topic_id)
            .eq("status", "active")
            .execute()
        )
        if existing_count.count >= 7:
            raise HTTPException(status_code=400, detail="Max 7 notes per topic reached")

    video_id = extract_video_id(data.url)

    transcript = None
    if not is_guest:
        existing_source = await run_in_threadpool(
            lambda: supabase.table("sources")
            .select("id, transcript")
            .eq("video_id", video_id)
            .execute()
        )
        if existing_source.data and existing_source.data[0]["transcript"]:
            transcript = existing_source.data[0]["transcript"]
            source_id = existing_source.data[0]["id"]

    if not transcript:
        transcript = await get_english_transcript(video_id)

        if not is_guest:
            new_source = await run_in_threadpool(
                lambda: supabase.table("sources").insert({
                    "video_url": data.url,
                    "video_id": video_id,
                    "transcript": transcript,
                    "topic_id": data.topic_id,
                    "is_playlist": False,
                }).execute()
            )
            source_id = new_source.data[0]["id"]

    title = data.title or await get_youtube_title(video_id) or "Untitled Note"
    full_content = await generate_notes_chunked(transcript)

    if not is_guest and data.topic_id and source_id:
        await run_in_threadpool(
            lambda: supabase.table("notes").insert({
                "topic_id": data.topic_id,
                "source_id": source_id,
                "title": title,
                "content": full_content,
                "status": "active",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
            }).execute()
        )

    return {"content": full_content, "title": title}


@router.get("/generate/notes/guest-remaining")
async def guest_notes_remaining(x_device_id: str = Header(alias="X-Device-ID")):
    remaining = await run_in_threadpool(get_guest_remaining, x_device_id)
    return {"remaining": remaining, "limit": 3}


@router.get("/notes/{topic_id}")
async def get_notes(topic_id: str, user=Depends(verify_token)):
    topic = await run_in_threadpool(
        lambda: supabase.table("topics")
        .select("subjects(user_id)")
        .eq("id", topic_id)
        .maybe_single()
        .execute()
    )
    if not topic.data or topic.data["subjects"]["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="You don't own that topic")

    notes = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("id, title, content, status, created_at, updated_at")
        .eq("topic_id", topic_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .execute()
    )
    return {"notes": notes.data}


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user=Depends(verify_token)):
    note = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("topic_id, topics(subjects(user_id))")
        .eq("id", note_id)
        .maybe_single()
        .execute()
    )
    if not note.data or note.data["topics"]["subjects"]["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="You don't own that note")

    await run_in_threadpool(
        lambda: supabase.table("notes")
        .update({"status": "deleted"})
        .eq("id", note_id)
        .execute()
    )
    return {"status": "deleted"}
