import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from db.supabase import client as supabase
from db.api_keys import get_gemini_response
from datetime import datetime, timezone, timedelta
from starlette.concurrency import run_in_threadpool
from services.prompts import build_weekly_summary_prompt
from services.context import get_weekly_attempts, get_already_summarised_users
import asyncio

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

BATCH_SIZE   = 10   # process users in batches of 10
MIN_ATTEMPTS = 10   # minimum quiz attempts to generate a summary
MAX_RETRIES  = 2    # retries per user on transient AI failures



# Note lifecycle

async def run_note_lifecycle():
    try:
        archive_result = await run_in_threadpool(lambda: supabase.rpc("archive_expired_notes").execute())
        logger.info(f"Archived expired notes: {archive_result.data}")
    except Exception as e:
        logger.error(f"archive_expired_notes failed: {e}")
        return

    try:
        delete_result = await run_in_threadpool(lambda: supabase.rpc("delete_old_archived_notes").execute())
        logger.info(f"Deleted old archived notes: {delete_result.data}")
    except Exception as e:
        logger.error(f"delete_old_archived_notes failed: {e}")



# Per-user generation with retry


async def _generate_and_save(user_id: str, attempts: list, week_start_str: str):
    prompt = build_weekly_summary_prompt(attempts)
    last_error = None

    for attempt_num in range(1, MAX_RETRIES + 2):
        try:
            response = await run_in_threadpool(get_gemini_response, prompt)
            summary = (
                response.text if hasattr(response, "text")
                else response.choices[0].message.content
            ).strip()

            await run_in_threadpool(
                lambda: supabase.table("weekly_summaries").insert({
                    "user_id": user_id,
                    "summary": summary,
                    "week_start": week_start_str,
                }).execute()
            )
            return

        except Exception as e:
            last_error = e
            if attempt_num <= MAX_RETRIES:
                wait = 2 ** attempt_num
                logger.warning(f"Retry {attempt_num}/{MAX_RETRIES} for user {user_id} in {wait}s — {e}")
                await asyncio.sleep(wait)

    raise last_error



# Main weekly summary job

async def generate_weekly_summaries():
    now = datetime.now(timezone.utc)
    one_week_ago    = (now - timedelta(days=7)).isoformat()
    week_start_str  = (now - timedelta(days=7)).date().isoformat()

    logger.info(f"Generating weekly summaries for week starting {week_start_str}")

    try:
        user_attempts = await get_weekly_attempts(one_week_ago)
    except Exception as e:
        logger.error(f"Failed fetching quiz attempts: {e}")
        return

    eligible = {
        uid: att for uid, att in user_attempts.items()
        if len(att) >= MIN_ATTEMPTS
    }

    if not eligible:
        logger.info("No eligible users for weekly summaries.")
        return

    try:
        already_done = await get_already_summarised_users(week_start_str, list(eligible.keys()))
    except Exception as e:
        logger.error(f"Failed checking existing summaries: {e}")
        return

    to_process = {uid: att for uid, att in eligible.items() if uid not in already_done}

    if not to_process:
        logger.info("All eligible users already have summaries this week.")
        return

    logger.info(f"Processing {len(to_process)} users in batches of {BATCH_SIZE}")

    user_ids = list(to_process.keys())
    for batch_start in range(0, len(user_ids), BATCH_SIZE):
        batch = user_ids[batch_start:batch_start + BATCH_SIZE]

        results = await asyncio.gather(*[
            _generate_and_save(uid, to_process[uid], week_start_str)
            for uid in batch
        ], return_exceptions=True)

        for uid, result in zip(batch, results):
            if isinstance(result, Exception):
                logger.error(f"Failed generating summary for user {uid}: {result}")
            else:
                logger.info(f"Summary saved for user {uid}")

        if batch_start + BATCH_SIZE < len(user_ids):
            await asyncio.sleep(5)

    logger.info("Weekly summary generation complete.")



# Chat session cleanup

async def delete_old_chat_sessions():
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=9)).isoformat()
        result = await run_in_threadpool(
            lambda: supabase.table("chat_sessions")
            .delete()
            .lt("created_at", cutoff)
            .execute()
        )
        logger.info(f"Deleted old chat sessions: {len(result.data)} removed")
    except Exception as e:
        logger.error(f"delete_old_chat_sessions failed: {e}")



# Scheduler setup

def start_scheduler():
    scheduler.add_job(
        run_note_lifecycle,
        trigger=CronTrigger(hour=2, minute=0),
        id="note_lifecycle",
        replace_existing=True,
    )
    scheduler.add_job(
        generate_weekly_summaries,
        trigger=CronTrigger(day_of_week="mon", hour=2, minute=10),
        id="weekly_summaries",
        replace_existing=True,
    )
    scheduler.add_job(
        delete_old_chat_sessions,
        trigger=CronTrigger(hour=3, minute=0),
        id="chat_session_cleanup",
        replace_existing=True,
    )
    scheduler.start()
