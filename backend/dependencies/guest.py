from fastapi import Header, HTTPException
from db.supabase import client as supabase

GUEST_NOTE_LIMIT = 3  # free notes before we prompt sign-up


async def check_guest_limit(x_device_id: str = Header(default=None, alias="X-Device-ID")):
    """
    Call this from guest-accessible routes.
    - If device_id missing: raises 400
    - If at/over limit: raises 403 with "guest_limit_reached" so frontend can show sign-up prompt
    - Otherwise: returns device_id string
    """
    if not x_device_id:
        raise HTTPException(status_code=400, detail="X-Device-ID header required")

    result = supabase.rpc(
        "check_and_reserve_guest_slot",
        {"p_device_id": x_device_id, "p_limit": GUEST_NOTE_LIMIT}
    ).execute()

    if result.data is False:
        raise HTTPException(status_code=403, detail="guest_limit_reached")

    return x_device_id


def get_guest_remaining(device_id: str) -> int:
    """Returns how many notes this guest device has left."""
    result = (
        supabase.table("guest_devices")
        .select("notes_count")
        .eq("device_id", device_id)
        .execute()
    )

    if not result.data:
        return GUEST_NOTE_LIMIT

    used = result.data[0]["notes_count"]
    return max(0, GUEST_NOTE_LIMIT - used)
