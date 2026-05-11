from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER
import re
from dependencies.auth import verify_token
from db.supabase import client as db
from datetime import datetime, timezone, timedelta
import pypdf
import io

router = APIRouter()


class NotesPDFRequest(BaseModel):
    note_ids: List[str]
    topic_id: Optional[str] = None


def render_note_content(story, title, content, styles, is_first=True):
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=18,
        textColor=colors.HexColor("#1a1a2e"), spaceAfter=8, alignment=TA_CENTER)
    heading_style = ParagraphStyle("H", parent=styles["Heading2"], fontSize=13,
        textColor=colors.HexColor("#16213e"), spaceBefore=14, spaceAfter=6)
    body_style = ParagraphStyle("B", parent=styles["Normal"], fontSize=10,
        leading=16, textColor=colors.HexColor("#333333"), spaceAfter=6)

    if not is_first:
        story.append(Spacer(1, 20))

    story.append(Paragraph(title, title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 10))

    for line in content.split("\n"):
        line = line.strip()
        line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
        if not line:
            story.append(Spacer(1, 6))
        elif line.startswith("## ") or line.startswith("# "):
            story.append(Paragraph(line.lstrip("#").strip(), heading_style))
        elif line.startswith("- ") or line.startswith("* "):
            story.append(Paragraph(f"• {line[2:]}", body_style))
        else:
            story.append(Paragraph(line, body_style))


def build_notes_pdf(notes: list[dict]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=inch, leftMargin=inch,
        topMargin=inch, bottomMargin=inch
    )
    styles = getSampleStyleSheet()
    story = []
    for i, note in enumerate(notes):
        render_note_content(
            story,
            title=note.get("title") or "Untitled Note",
            content=note.get("content") or "",
            styles=styles,
            is_first=(i == 0)
        )
    doc.build(story)
    return buffer.getvalue()


@router.post("/pdf/notes")
async def export_notes_pdf(data: NotesPDFRequest, user=Depends(verify_token)):
    if not data.note_ids:
        raise HTTPException(status_code=400, detail="No note IDs provided")
    if len(data.note_ids) > 20:
        raise HTTPException(status_code=400, detail="Max 20 notes per PDF export")

    # ── Rate limit: 1 per day, 3 per week ────────────────────────────────────
    now = datetime.now(timezone.utc)
    one_day_ago = (now - timedelta(days=1)).isoformat()
    one_week_ago = (now - timedelta(weeks=1)).isoformat()

    exports = db.table("pdf_exports")\
        .select("created_at")\
        .eq("user_id", user["sub"])\
        .gte("created_at", one_week_ago)\
        .execute()

    exports_today = [e for e in exports.data if e["created_at"] >= one_day_ago]

    if len(exports_today) >= 5:
        raise HTTPException(status_code=429, detail="PDF export limit: 5 per day")
    if len(exports.data) >= 10:
        raise HTTPException(status_code=429, detail="PDF export limit: 10 per week")

    # ── Ownership check ───────────────────────────────────────────────────────
    ownership = db.table("notes")\
        .select("id, topics(subjects(user_id))")\
        .in_("id", data.note_ids)\
        .execute()

    fetched_ids = {n["id"] for n in ownership.data}
    missing = set(data.note_ids) - fetched_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Notes not found: {', '.join(missing)}")

    not_owned = [
        n["id"] for n in ownership.data
        if n["topics"]["subjects"]["user_id"] != user["sub"]
    ]
    if not_owned:
        raise HTTPException(status_code=403, detail="You don't own all selected notes")

    # ── Fetch note content ────────────────────────────────────────────────────
    query = db.table("notes").select("title, content").in_("id", data.note_ids)
    if data.topic_id:
        query = query.eq("topic_id", data.topic_id)

    result = query.execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No notes found")

    # ── Build PDF ─────────────────────────────────────────────────────────────
    pdf_bytes = build_notes_pdf(result.data)

    # ── Log export only after successful build ────────────────────────────────
    db.table("pdf_exports").insert({
        "user_id": user["sub"],
        "note_ids": data.note_ids,
    }).execute()

    filename = "notes.pdf" if len(result.data) == 1 else f"notes_{len(result.data)}_combined.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/pdf/extract")
async def extract_pdf_text(
    file: UploadFile = File(...),
    user=Depends(verify_token)
):
    # ── Rate limit: 10 extractions per day
    now = datetime.now(timezone.utc)
    one_day_ago = (now - timedelta(days=1)).isoformat()

    extractions = db.table("pdf_extractions")\
        .select("id", count="exact")\
        .eq("user_id", user["sub"])\
        .gte("created_at", one_day_ago)\
        .execute()

    if extractions.count >= 10:
        raise HTTPException(status_code=429, detail="PDF extraction limit: 10 per day")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    if file.size and file.size > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large. Max size is 20MB")
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large. Max size is 20MB")

    if not contents.startswith(b'%PDF'):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    try:
        reader = pypdf.PdfReader(io.BytesIO(contents))
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text.strip())

        if not pages_text:
            raise HTTPException(status_code=422, detail="Could not extract text from this PDF. It may be scanned/image-based.")

        full_text = "\n\n".join(pages_text)

        # ── Log after successful extraction
        db.table("pdf_extractions").insert({
            "user_id": user["sub"],
        }).execute()

        return {
            "text": full_text,
            "pages": len(reader.pages),
            "chars": len(full_text)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")