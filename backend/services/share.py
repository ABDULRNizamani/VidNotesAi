import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone, timedelta
from starlette.concurrency import run_in_threadpool
from db.supabase import client as supabase
from dependencies.auth import verify_token

router = APIRouter()


class CreateShareRequest(BaseModel):
    note_ids: List[str]


class ImportShareRequest(BaseModel):
    topic_id: str


@router.post("/share/create")
async def create_share_link(data: CreateShareRequest, user=Depends(verify_token)):
    if not data.note_ids:
        raise HTTPException(status_code=400, detail="note_ids required")

    result = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("id, topics(subject_id, subjects(user_id))")
        .in_("id", data.note_ids)
        .execute()
    )

    fetched_ids = {n["id"] for n in result.data}
    missing = set(data.note_ids) - fetched_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Notes not found: {', '.join(missing)}")

    not_owned = [
        n["id"] for n in result.data
        if n["topics"]["subjects"]["user_id"] != user["sub"]
    ]
    if not_owned:
        raise HTTPException(status_code=403, detail="You don't own all selected notes")

    for _ in range(5):
        token = secrets.token_urlsafe(32)
        existing_token = await run_in_threadpool(
            lambda t=token: supabase.table("share_links").select("token").eq("token", t).execute()
        )
        if not existing_token.data:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique share token")

    await run_in_threadpool(
        lambda: supabase.table("share_links").insert({
            "user_id": user["sub"],
            "note_ids": data.note_ids,
            "token": token,
            "share_count": 0,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        }).execute()
    )

    # Atomic increment via RPC to avoid read-then-write race condition
    increment_result = await run_in_threadpool(
        lambda: supabase.rpc(
            "increment_profile_share_count",
            {"p_user_id": user["sub"]}
        ).execute()
    )
    new_count = increment_result.data if increment_result.data is not None else 1

    warn = new_count > 3

    return {
        "token": token,
        "warn": warn,
        "warn_message": "Recipients will need a VidNotesAI account to import these notes." if warn else None,
    }


@router.get("/share/preview/{token}")
async def preview_share(token: str):
    link = await run_in_threadpool(
        lambda: supabase.table("share_links")
        .select("*")
        .eq("token", token)
        .maybe_single()
        .execute()
    )
    if not link.data:
        raise HTTPException(status_code=404, detail="Share link not found")

    if link.data.get("expires_at"):
        expires = datetime.fromisoformat(link.data["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=410, detail="Share link has expired")

    notes = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("id, title, content")
        .in_("id", link.data["note_ids"])
        .execute()
    )

    previews = [
        {
            "id": n["id"],
            "title": n["title"],
            "preview": n["content"][:120] + "..." if n["content"] else "",
        }
        for n in notes.data
    ]

    return {"notes": previews, "requires_account": True}


@router.post("/share/import/{token}")
async def import_share(token: str, data: ImportShareRequest, user=Depends(verify_token)):
    link = await run_in_threadpool(
        lambda: supabase.table("share_links")
        .select("*")
        .eq("token", token)
        .maybe_single()
        .execute()
    )
    if not link.data:
        raise HTTPException(status_code=404, detail="Share link not found")

    if link.data.get("expires_at"):
        expires = datetime.fromisoformat(link.data["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=410, detail="Share link has expired")

    topic = await run_in_threadpool(
        lambda: supabase.table("topics")
        .select("subjects(user_id)")
        .eq("id", data.topic_id)
        .maybe_single()
        .execute()
    )
    if not topic.data or topic.data["subjects"]["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="You don't own that topic")

    originals = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("title, content, source_id")
        .in_("id", link.data["note_ids"])
        .execute()
    )

    existing_count = await run_in_threadpool(
        lambda: supabase.table("notes")
        .select("id", count="exact")
        .eq("topic_id", data.topic_id)
        .eq("status", "active")
        .execute()
    )
    if existing_count.count + len(originals.data) > 7:
        raise HTTPException(status_code=400, detail="Import would exceed the 7-note limit for this topic")

    imported_ids = []
    for note in originals.data:
        new = await run_in_threadpool(
            lambda n=note: supabase.table("notes").insert({
                "topic_id": data.topic_id,
                "source_id": n.get("source_id"),
                "title": n["title"],
                "content": n["content"],
                "status": "active",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
            }).execute()
        )
        imported_ids.append(new.data[0]["id"])

    await run_in_threadpool(
        lambda: supabase.table("share_links")
        .update({"share_count": link.data["share_count"] + 1})
        .eq("token", token)
        .execute()
    )

    return {"imported_note_ids": imported_ids}
