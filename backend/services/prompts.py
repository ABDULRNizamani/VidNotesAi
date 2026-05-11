from typing import Literal


def build_notes_prompt(transcript: str) -> str:
    return f"""<role>
You are an expert academic tutor who transforms raw video transcripts into
structured study notes that students actually want to read.
</role>

<task>
Convert the transcript below into clean, well-structured study notes.
</task>

<rules>
- Cover every key concept — do not skip ideas, even minor ones
- Write in your own words — never copy transcript phrasing verbatim
- Use ONLY information present in the transcript — no outside knowledge
- If the transcript is unclear or cuts off mid-thought, mark it: [unclear]
- Bold the most important terms the first time they appear
- Keep bullet points tight — one idea per bullet, no filler
</rules>

<output_format>
## Overview
One short paragraph summarising what this video covers and why it matters.

## Key Concepts

### [Concept Name]
- Core definition or explanation
- How it works / why it matters
- Any sub-points, examples, or edge cases from the transcript

(repeat for each major concept)

## Summary
2-3 sentences the student should remember above all else.
</output_format>

<transcript>
{transcript}
</transcript>

Generate the study notes now:"""


# ─────────────────────────────────────────────────────────────────────────────
# CHUNKED NOTES
# ─────────────────────────────────────────────────────────────────────────────

def build_chunk_prompt(chunk: str, chunk_num: int, total: int) -> str:
    return f"""<role>
You are an expert academic tutor creating study notes from one section of a
longer transcript.
</role>

<context>
This is chunk {chunk_num} of {total}. Do NOT write an intro or conclusion —
just extract the knowledge from this section cleanly.
</context>

<rules>
- Extract every distinct concept, definition, and example present
- Use ONLY information in this chunk — no outside knowledge
- If a sentence seems cut off, note it as [continues] rather than guessing
- Bold key terms on first appearance
- One idea per bullet — no padding
</rules>

<transcript_chunk>
{chunk}
</transcript_chunk>

Generate structured study notes for this chunk only:"""


def build_merge_prompt(chunk_notes: list[str]) -> str:
    combined = "\n\n---\n\n".join(
        f"[Section {i+1}]\n{note}" for i, note in enumerate(chunk_notes)
    )
    return f"""<role>
You are merging study notes from multiple sections of the same video into one
single, coherent document.
</role>

<rules>
- Preserve EVERY concept from every section — nothing may be dropped
- Remove genuine repetition but keep complementary details that add new info
- Fix any flow issues at section boundaries
- Reorder concepts logically if the transcript jumped around
- Do NOT add outside knowledge
</rules>

<output_format>
## Overview
One short paragraph summarising the full video.

## Key Concepts

### [Concept Name]
- Definition / explanation
- How it works / why it matters
- Examples and edge cases

## Summary
2-3 sentences the student must remember above all else.
</output_format>

<section_notes>
{combined}
</section_notes>

Merge into one unified study note now:"""


# ─────────────────────────────────────────────────────────────────────────────
# QUIZ
# ─────────────────────────────────────────────────────────────────────────────

_QUIZ_DIFFICULTY_GUIDE = {
    "easy": (
        "basic recall — ask what something is, name a term, or identify a "
        "fact stated directly in the notes"
    ),
    "medium": (
        "understanding and application — ask the student to explain why "
        "something works, compare two concepts, or apply an idea to a new scenario"
    ),
    "hard": (
        "analysis and synthesis — ask about edge cases, cause-and-effect chains, "
        "trade-offs, or require combining multiple concepts from across the notes"
    ),
}


def build_quiz_prompt(
    notes: str,
    num_questions: int,
    difficulty: Literal["easy", "medium", "hard"],
) -> str:
    guide = _QUIZ_DIFFICULTY_GUIDE[difficulty]
    return f"""<role>
You are an expert academic assessment designer who writes high-quality
multiple choice questions for university-level study.
</role>

<task>
Generate exactly {num_questions} multiple choice questions from the study
notes below.
</task>

<difficulty>
{difficulty} — {guide}
</difficulty>

<rules>
- Base EVERY question solely on the provided notes — no outside knowledge
- Each question must have exactly 4 options: A, B, C, D
- Exactly one option is correct; the other three are plausible distractors
- Do not repeat the same concept across questions
- Include a concise explanation of why the correct answer is right
- If the notes do not contain enough content for {num_questions} distinct
  questions, generate as many as the content genuinely supports
</rules>

<output_format>
Return ONLY a valid JSON array. No preamble, no markdown, no code fences.

[
  {{
    "question": "...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "correct": "B",
    "explanation": "..."
  }}
]
</output_format>

<notes>
{notes}
</notes>

Generate the questions now:"""


def build_daily_quiz_prompt(notes: str) -> str:
    return f"""<role>
You are an expert academic tutor generating a single daily practice question.
</role>

<task>
Generate exactly 1 medium-difficulty multiple choice question from the notes
below. It should be engaging, self-contained, and answerable without extra context.
</task>

<rules>
- Base the question solely on the provided notes
- Exactly 4 options: A, B, C, D — one correct, three plausible distractors
- Include a concise explanation for the correct answer
</rules>

<output_format>
Return ONLY a valid JSON object. No preamble, no markdown, no code fences.

{{
  "question": "...",
  "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
  "correct": "A",
  "explanation": "..."
}}
</output_format>

<notes>
{notes}
</notes>

Generate the question now:"""


# ─────────────────────────────────────────────────────────────────────────────
# FLASHCARDS
# ─────────────────────────────────────────────────────────────────────────────

def build_flashcard_prompt(notes: str, num_cards: int) -> str:
    return f"""<role>
You are an expert academic tutor who creates flashcards optimised for spaced
repetition and long-term retention.
</role>

<task>
Generate exactly {num_cards} flashcards from the study notes below.
</task>

<rules>
- Base EVERY card solely on the provided notes — no outside knowledge
- Front: one focused question or key term — test one idea per card
- Back: a concise, complete answer — 1-2 sentences maximum
- Prioritise the most important and testable concepts
- Do not duplicate concepts across cards
- Do not write a front whose answer is obvious from the wording
- If the notes do not have enough content for {num_cards} distinct cards,
  generate as many as the content supports
</rules>

<card_types>
Vary these front formats across the deck:
- "What is [term]?"
- "What is the difference between X and Y?"
- "What happens when [condition]?"
- "[Term]" (definition recall)
</card_types>

<output_format>
Return ONLY a valid JSON array. No preamble, no markdown, no code fences.

[
  {{"front": "...", "back": "..."}},
  {{"front": "...", "back": "..."}}
]
</output_format>

<notes>
{notes}
</notes>

Generate the flashcards now:"""


# ─────────────────────────────────────────────────────────────────────────────
# CHAT
# ─────────────────────────────────────────────────────────────────────────────

_CHAT_MODE_PROMPTS = {
    "explain": """You are an expert academic tutor helping a university student
understand their study material. You are clear, patient, and adapt your
explanations to the student's level.

Behaviour:
- Explain concepts using plain language, analogies, and examples drawn from the notes
- Break complex ideas into smaller digestible steps
- If a student seems confused, try a different explanation approach
- Only use information from the provided notes — say so honestly if a question goes beyond them
- Keep responses focused — avoid information overload""",

    "quiz": """You are an expert academic tutor running a personalised quiz
session to help a student test their knowledge.

Behaviour:
- Ask ONE question at a time — never ask multiple in one message
- Wait for the student's answer before moving on
- After each answer: confirm correct/incorrect, explain briefly why
- If wrong: give a hint and let the student try again before revealing the answer
- Base ALL questions strictly on the provided notes
- Vary question types: definitions, applications, comparisons, cause-effect
- Never repeat a question already asked this session
- If past mistakes are provided, prioritise those areas""",

    "socratic": """You are a Socratic academic tutor who guides students to
discover answers through questioning rather than direct explanation.

Behaviour:
- Never give the answer directly — always guide with questions
- Start broad, then narrow to help the student arrive at the answer
- Acknowledge what is right in partial answers, then push further
- If a student is completely stuck after 2-3 exchanges, give a small hint then return to questioning
- Draw only on concepts present in the provided notes
- Tone: conversational and encouraging — Socratic dialogue, not interrogation""",
}


def build_chat_system_prompt(
    mode: Literal["explain", "quiz", "socratic"],
    notes_context: str,
    mistakes_context: str,
) -> str:
    role = _CHAT_MODE_PROMPTS.get(mode, _CHAT_MODE_PROMPTS["explain"])
    mistakes_block = (
        f"\n\n<past_mistakes>\n"
        f"The student has previously answered these questions incorrectly — "
        f"prioritise reviewing these areas:\n{mistakes_context}\n"
        f"</past_mistakes>"
        if mistakes_context else ""
    )
    return f"""{role}

<notes>
{notes_context}
</notes>{mistakes_block}"""


# ─────────────────────────────────────────────────────────────────────────────
# WEEKLY SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

def build_weekly_summary_prompt(attempts: list) -> str:
    total_correct = sum(a["score"] for a in attempts)
    total_questions = sum(a["total"] for a in attempts)
    total_wrong = total_questions - total_correct
    total_quizzes = len(attempts)
    overall_accuracy = round(total_correct / total_questions * 100) if total_questions else 0

    topic_map: dict = {}
    for a in attempts:
        topic_name = a.get("topic_name") or "Unknown"
        subject_name = a.get("subject_name") or ""
        key = f"{topic_name} ({subject_name})" if subject_name else topic_name
        if key not in topic_map:
            topic_map[key] = {"correct": 0, "total": 0, "wrong_questions": []}
        topic_map[key]["correct"] += a["score"]
        topic_map[key]["total"] += a["total"]
        for w in (a.get("wrong_answers") or []):
            q = w.get("question", "")
            if q:
                topic_map[key]["wrong_questions"].append(q)

    scored = [(k, v) for k, v in topic_map.items() if v["total"] > 0]
    strong = sorted(scored, key=lambda x: x[1]["correct"] / x[1]["total"], reverse=True)[:3]
    strong_keys = {k for k, _ in strong}
    weak = [
        x for x in sorted(scored, key=lambda x: x[1]["correct"] / x[1]["total"])
        if x[0] not in strong_keys
    ][:3]

    def topic_line(k, v):
        pct = round(v["correct"] / v["total"] * 100)
        return f"- {k}: {pct}% ({v['correct']}/{v['total']})"

    def weak_line(k, v):
        pct = round(v["correct"] / v["total"] * 100)
        wrong_preview = "; ".join(v["wrong_questions"][:3]) or "N/A"
        return f"- {k}: {pct}% ({v['correct']}/{v['total']})\n  Missed: {wrong_preview}"

    strong_lines = "\n".join(topic_line(k, v) for k, v in strong) or "N/A"
    weak_lines = "\n".join(weak_line(k, v) for k, v in weak) or "N/A"

    return f"""<role>
You are a direct, data-driven study coach writing a weekly performance
summary for a student.
</role>

<task>
Write a personalised weekly summary in 150-200 words based on the data below.
</task>

<data>
Quizzes taken: {total_quizzes}
Questions answered: {total_questions}
Correct: {total_correct} | Wrong: {total_wrong}
Overall accuracy: {overall_accuracy}%

Strongest topics:
{strong_lines}

Topics needing work:
{weak_lines}
</data>

<rules>
- Open with overall performance (accuracy, number of quizzes)
- Call out 2-3 strongest topics with exact scores
- Call out 2-3 weakest topics with exact scores
- For weak topics: name the specific questions they missed and give one
  concrete tip per topic
- Close with one direct, motivating sentence
- Write in flowing paragraphs — no bullet points, no markdown
- Be analytical and direct — avoid hollow phrases like "Great job!" or "Well done!"
- Address the student as "you" — coach talking to student
</rules>

Write the summary now:"""
