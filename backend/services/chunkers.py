import asyncio
import logging
from starlette.concurrency import run_in_threadpool
from db.api_keys import get_gemini_notes
from services.prompts import build_notes_prompt, build_chunk_prompt, build_merge_prompt

logger = logging.getLogger(__name__)

CHUNK_SIZE = 12_000
OVERLAP     = 500


def split_transcript(text: str) -> list[str]:
    if len(text) <= CHUNK_SIZE:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        start += CHUNK_SIZE - OVERLAP
    return chunks


async def generate_notes_chunked(transcript: str) -> str:
    logger.info(f"[chunker] transcript length: {len(transcript)} chars")

    chunks = split_transcript(transcript)
    logger.info(f"[chunker] split into {len(chunks)} chunk(s)")

    if len(chunks) == 1:
        logger.info("[chunker] single chunk — using normal prompt")
        try:
            result = await run_in_threadpool(get_gemini_notes, build_notes_prompt(transcript))
            logger.info(f"[chunker] single chunk result length: {len(result) if result else 'None'}")
            return result
        except Exception as e:
            logger.error(f"[chunker] ERROR on single chunk generation: {type(e).__name__}: {e}")
            raise

    logger.info(f"[chunker] starting parallel generation for {len(chunks)} chunks")
    sem = asyncio.Semaphore(3)

    async def bounded(prompt: str) -> str:
        async with sem:
            return await run_in_threadpool(get_gemini_notes, prompt)

    try:
        tasks = [
            bounded(build_chunk_prompt(chunk, i + 1, len(chunks)))
            for i, chunk in enumerate(chunks)
        ]
        chunk_notes = await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error(f"[chunker] ERROR during asyncio.gather: {type(e).__name__}: {e}")
        raise

    clean_notes = []
    for i, result in enumerate(chunk_notes):
        if isinstance(result, Exception):
            logger.error(f"[chunker] chunk {i+1} FAILED: {type(result).__name__}: {result}")
            raise result
        logger.info(f"[chunker] chunk {i+1} OK — {len(result) if result else 'None'} chars")
        clean_notes.append(result)

    logger.info("[chunker] all chunks done, starting merge pass")
    try:
        merged = await run_in_threadpool(get_gemini_notes, build_merge_prompt(clean_notes))
        logger.info(f"[chunker] merge done — final length: {len(merged) if merged else 'None'} chars")
        return merged
    except Exception as e:
        logger.error(f"[chunker] ERROR on merge pass: {type(e).__name__}: {e}")
        raise
