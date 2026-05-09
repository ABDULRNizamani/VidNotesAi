import asyncio
import logging
import time
from collections import defaultdict
from fastapi import Depends, HTTPException
from dependencies.auth import verify_token

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 10
PER_USER_LIMIT = 2
RATE_WINDOW = 60
RATE_MAX_REQUESTS = 30
MAX_CONCURRENT_PLAYLIST = 1
MAX_HOLD_TIME = 120

_global_semaphore: asyncio.Semaphore | None = None
_playlist_semaphore: asyncio.Semaphore | None = None

def get_global_semaphore() -> asyncio.Semaphore:
    global _global_semaphore
    if _global_semaphore is None:
        _global_semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    return _global_semaphore

def get_playlist_semaphore() -> asyncio.Semaphore:
    global _playlist_semaphore
    if _playlist_semaphore is None:
        _playlist_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PLAYLIST)
    return _playlist_semaphore

_user_request_times: dict[str, list[float]] = defaultdict(list)
_user_semaphores: dict[str, asyncio.Semaphore] = {}

def _get_user_semaphore(user_id: str) -> asyncio.Semaphore:
    if user_id not in _user_semaphores:
        _user_semaphores[user_id] = asyncio.Semaphore(PER_USER_LIMIT)
    sem = _user_semaphores[user_id]
    logger.debug("user=%s semaphore value=%s", user_id, sem._value)
    return sem

def _check_rate_limit(user_id: str):
    now = time.time()
    window_start = now - RATE_WINDOW
    pruned = [t for t in _user_request_times[user_id] if t > window_start]

    if len(pruned) >= RATE_MAX_REQUESTS:
        oldest = pruned[0]
        retry_after = int(RATE_WINDOW - (now - oldest)) + 1
        _user_request_times[user_id] = pruned
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. You can make {RATE_MAX_REQUESTS} AI requests per {RATE_WINDOW}s. "
                   f"Retry after {retry_after}s.",
            headers={"Retry-After": str(retry_after)}
        )

    pruned.append(now)
    _user_request_times[user_id] = pruned


async def _acquire_with_timeout(sem: asyncio.Semaphore, timeout: float) -> bool:
    try:
        async with asyncio.timeout(timeout):
            await sem.acquire()
        return True
    except TimeoutError:
        return False
    

async def _hold_time_watchdog(
    deadline: float,
    user_sem: asyncio.Semaphore,
    global_sem: asyncio.Semaphore,
    user_id: str,
    done: asyncio.Event,
):
    delay = deadline - time.monotonic()
    if delay > 0:
        await asyncio.sleep(delay)

    if not done.is_set():
        logger.error(
            "Handler for user=%s exceeded MAX_HOLD_TIME=%ss — force-releasing semaphores.",
            user_id,
            MAX_HOLD_TIME,
        )
        try:
            user_sem.release()
        except RuntimeError:
            pass
        try:
            global_sem.release()
        except RuntimeError:
            pass


class AILimiter:
    async def __call__(self, user=Depends(verify_token)):
        user_id = user["sub"]
        _check_rate_limit(user_id)

        user_sem = _get_user_semaphore(user_id)
        if not await _acquire_with_timeout(user_sem, timeout=5):
            raise HTTPException(
                status_code=429,
                detail=f"You already have {PER_USER_LIMIT} requests running. Wait for one to finish."
            )

        global_sem = get_global_semaphore()
        if not await _acquire_with_timeout(global_sem, timeout=5):
            user_sem.release()
            raise HTTPException(
                status_code=503,
                detail="Server is busy processing other requests. Please try again in a moment."
            )

        done = asyncio.Event()
        deadline = time.monotonic() + MAX_HOLD_TIME
        watchdog = asyncio.ensure_future(
            _hold_time_watchdog(deadline, user_sem, global_sem, user_id, done)
        )

        try:
            yield user
        except Exception:
            raise
        finally:
            done.set()
            watchdog.cancel()
            try:
                user_sem.release()
            except RuntimeError:
                pass
            try:
                global_sem.release()
            except RuntimeError:
                pass


ai_limit = AILimiter()