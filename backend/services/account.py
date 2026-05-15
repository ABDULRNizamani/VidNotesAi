import logging
from fastapi import APIRouter, Depends, HTTPException
from db.supabase import client as supabase
from dependencies.auth import verify_token

logger = logging.getLogger(__name__)

router = APIRouter()


@router.delete("/account")
async def delete_account(user: dict = Depends(verify_token)):
    """
    Permanently deletes the authenticated user's account.
    All user data is removed via Supabase FK cascades.
    Requires service role key — never expose raw user JWT to admin API.
    """
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=400, detail="Invalid token — no user ID")

    try:
        response = supabase.auth.admin.delete_user(uid)

        # supabase-py returns a User object on success; None or raises on failure
        if response is None:
            raise HTTPException(status_code=500, detail="Deletion failed")

        logger.info(f"[account] deleted user {uid}")
        return {"ok": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[account] delete_user error for {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")
