from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from db.supabase import client as supabase
from dependencies.auth import verify_token

router = APIRouter()


class RegisterDeviceRequest(BaseModel):
    device_id: str = Field(..., min_length=8, max_length=128)


@router.post("/devices/register")
async def register_device(data: RegisterDeviceRequest, user=Depends(verify_token)):
    existing = await run_in_threadpool(
        lambda: supabase.table("user_devices")
        .select("user_id")
        .eq("device_id", data.device_id)
        .execute()
    )

    if existing.data:
        existing_user_id = existing.data[0]["user_id"]
        if existing_user_id != user["sub"]:
            raise HTTPException(
                status_code=409,
                detail="device_already_registered"
            )
        return {"status": "already_registered"}

    count = await run_in_threadpool(
        lambda: supabase.table("user_devices")
        .select("id", count="exact")
        .eq("user_id", user["sub"])
        .execute()
    )
    if count.count >= 10:
        raise HTTPException(400, "Device limit reached")

    await run_in_threadpool(
        lambda: supabase.table("user_devices").insert({
            "user_id": user["sub"],
            "device_id": data.device_id,
        }).execute()
    )

    return {"status": "registered"}
