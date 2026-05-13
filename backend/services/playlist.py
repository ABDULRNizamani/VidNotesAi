import os
import json
import httpx
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
from urllib.parse import urlparse, parse_qs
from starlette.concurrency import run_in_threadpool
from db.supabase import client as supabase
from datetime import datetime, timezone, timedelta
from dependencies.auth import verify_token
from services.queue import _check_rate_limit, get_playlist_semaphore
from services.chunkers import generate_notes_chunked

router = APIRouter()
logger = logging.getLogger(__name__)

# Track which users currently have a playlist job running so we can
# reject a second request from the same user immediately.
_active_playlist_users: set[str] = set()
_active_playlist_lock = asyncio.Lock()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
SUPADATA_API_KEY = os.getenv("SUPADATA_API_KEY")
MAX_PLAYLIST_VIDEOS = 10


# ── Helpers

def extract_playlist_id(url: str) -> str:
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    if "list" not in params:
        raise HTTPException(status_code=400, detail="No playlist ID found in URL")
    return params["list"][0]


async def fetch_playlist_info(playlist_id: str) -> dict:
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=503, detail="YouTube API not configured")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/playlistItems",
            params={
                "part": "snippet,contentDetails",
                "playlistId": playlist_id,
                "maxResults": MAX_PLAYLIST_VIDEOS,
                "key": YOUTUBE_API_KEY,
            },
            timeout=15,
        )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Playlist not found or is private")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch playlist from YouTube")

    data = resp.json()
    items = data.get("items", [])
    total = data.get("pageInfo", {}).get("totalResults", len(items))

    videos = []
    for item in items:
        snippet = item.get("snippet", {})
        video_id = snippet.get("resourceId", {}).get("videoId")
        title = snippet.get("title", "Untitled")
        if not video_id or title in ("Deleted video", "Private video"):
            continue
        videos.append({
            "video_id": video_id,
            "title": title,
            "position": snippet.get("position", 0),
        })

    return {
        "playlist_id": playlist_id,
        "total_videos": total,
        "capped": total > MAX_PLAYLIST_VIDEOS,
        "videos": videos,
    }


async def get_transcript(video_id: str) -> str:
    """Fetch transcript via Supadata — same service used by single-video notes."""
    if not SUPADATA_API_KEY:
        logger.error("[playlist] SUPADATA_API_KEY not configured")
        return ""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.supadata.ai/v1/youtube/transcript",
                params={"videoId": video_id, "lang": "en"},
                headers={"x-api-key": SUPADATA_API_KEY},
                timeout=30,
            )
        if resp.status_code != 200:
            logger.warning(f"[playlist] Supadata {resp.status_code} for {video_id}")
            return ""
        content = resp.json().get("content", [])
        if not content:
            logger.warning(f"[playlist] Supadata returned empty content for {video_id}")
            return ""
        transcript = " ".join(
            chunk["text"].replace("\n", " ") for chunk in content if chunk.get("text")
        )
        logger.info(f"[playlist] transcript OK for {video_id}: {len(transcript)} chars")
        return transcript
    except Exception as e:
        logger.warning(f"[playlist] Supadata request failed for {video_id}: {type(e).__name__}: {e}")
        return ""


# ── Routes

class VideoItem(BaseModel):
    topic_id: str
    video_id: str
    title: Optional[str] = "Untitled"


class GeneratePlaylistRequest(BaseModel):
    playlist_url: str
    subject_id: str
    videos: List[VideoItem]


@router.get("/playlist/info")
async def playlist_info(url: str, user=Depends(verify_token)):
    playlist_id = extract_playlist_id(url)
    info = await fetch_playlist_info(playlist_id)
    return info


def _sse(event: str, data: dict) -> str:
    """Format a single SSE message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/generate/playlist")
async def generate_playlist(
    data: GeneratePlaylistRequest,
    user=Depends(verify_token),
):
    # ── Validate subject ownership ──
    subject = await run_in_threadpool(
        lambda: supabase.table("subjects")
        .select("user_id")
        .eq("id", data.subject_id)
        .maybe_single()
        .execute()
    )
    if not subject.data or subject.data["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="You don't own that subject")

    if not data.videos:
        raise HTTPException(status_code=400, detail="No videos provided")

    if len(data.videos) > MAX_PLAYLIST_VIDEOS:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PLAYLIST_VIDEOS} videos per playlist")

    user_id = user["sub"]

    async with _active_playlist_lock:
        if user_id in _active_playlist_users:
            raise HTTPException(
                status_code=429,
                detail="You already have a playlist generating. Wait for it to finish."
            )
        _active_playlist_users.add(user_id)

    _check_rate_limit(user_id)

    # ── Pre-validate ALL topic ownership before streaming starts ──
    valid_topic_ids = {v.topic_id for v in data.videos}
    topic_checks = await run_in_threadpool(
        lambda: supabase.table("topics")
        .select("id")
        .in_("id", list(valid_topic_ids))
        .eq("subject_id", data.subject_id)
        .execute()
    )
    valid = {t["id"] for t in topic_checks.data}
    invalid = valid_topic_ids - valid
    if invalid:
        async with _active_playlist_lock:
            _active_playlist_users.discard(user_id)
        raise HTTPException(
            status_code=403,
            detail=f"Access denied to topics: {', '.join(invalid)}"
        )

    playlist_id = extract_playlist_id(data.playlist_url)

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async with get_playlist_semaphore():
                for index, video in enumerate(data.videos):
                    topic_id = video.topic_id
                    video_id = video.video_id
                    title = video.title

                    await run_in_threadpool(
                        lambda tid=topic_id: supabase.table("topics")
                        .update({"generation_status": "generating"})
                        .eq("id", tid)
                        .execute()
                    )

                    transcript = await get_transcript(video_id)

                    if not transcript:
                        await run_in_threadpool(
                            lambda tid=topic_id: supabase.table("topics")
                            .update({"generation_status": "failed"})
                            .eq("id", tid)
                            .execute()
                        )
                        yield _sse("topic_failed", {
                            "topic_id": topic_id,
                            "index": index,
                            "reason": "No transcript available",
                        })
                        continue

                    existing = await run_in_threadpool(
                        lambda vid=video_id: supabase.table("sources")
                        .select("id")
                        .eq("video_id", vid)
                        .execute()
                    )

                    if existing.data:
                        source_id = existing.data[0]["id"]
                    else:
                        new_source = await run_in_threadpool(
                            lambda vid=video_id, tr=transcript, tid=topic_id: supabase.table("sources").insert({
                                "video_url": f"https://www.youtube.com/watch?v={vid}",
                                "video_id": vid,
                                "transcript": tr,
                                "topic_id": tid,
                                "playlist_id": playlist_id,
                                "is_playlist": True,
                            }).execute()
                        )
                        source_id = new_source.data[0]["id"]

                    try:
                        full_content = await generate_notes_chunked(transcript)
                    except Exception as e:
                        logger.error(f"[playlist] AI failed for video {video_id}: {type(e).__name__}: {e}")
                        await run_in_threadpool(
                            lambda tid=topic_id: supabase.table("topics")
                            .update({"generation_status": "failed"})
                            .eq("id", tid)
                            .execute()
                        )
                        yield _sse("topic_failed", {
                            "topic_id": topic_id,
                            "index": index,
                            "reason": str(e),
                        })
                        continue

                    await run_in_threadpool(
                        lambda tid=topic_id, sid=source_id, t=title, fc=full_content: supabase.table("notes").insert({
                            "topic_id": tid,
                            "source_id": sid,
                            "title": t,
                            "content": fc,
                            "status": "active",
                            "expires_at": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
                        }).execute()
                    )

                    await run_in_threadpool(
                        lambda tid=topic_id: supabase.table("topics")
                        .update({"generation_status": "done"})
                        .eq("id", tid)
                        .execute()
                    )

                    yield _sse("topic_done", {"topic_id": topic_id, "index": index})

            yield _sse("playlist_done", {})

        except Exception as e:
            logger.error(f"[playlist] stream error: {type(e).__name__}: {e}")
            yield _sse("playlist_error", {"reason": str(e)})
        finally:
            async with _active_playlist_lock:
                _active_playlist_users.discard(user_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )
