from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from services.notes import router as notes_router
from services.quiz import router as quiz_router
from services.flashcard import router as flashcard_router
from services.chatbot import router as chatBot_router
from services.pdf import router as pdf_router
from services.share import router as share_router
from services.daily_quiz import router as daily_quiz_router
from services.devices import router as devices_router
from services.playlist import router as playlist_router
from services.scheduler import start_scheduler
import logging

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        start_scheduler()
    except Exception as e:
        logging.error(f"Scheduler failed to start: {e} — API will continue without it")
    yield


app = FastAPI(
    title="VidNotesAi",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
)

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(notes_router)
app.include_router(quiz_router)
app.include_router(flashcard_router)
app.include_router(chatBot_router)
app.include_router(pdf_router, prefix="/api")
app.include_router(share_router)
app.include_router(devices_router)
app.include_router(daily_quiz_router)
app.include_router(playlist_router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title="VidNotesAi", version="1.0.0", routes=app.routes)
    schema.setdefault("components", {})["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer"}
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation["security"] = [{"BearerAuth": []}]
    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/health")
def test():
    return {"status": "ok"}
