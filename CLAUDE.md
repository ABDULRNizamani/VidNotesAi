
```markdown
# VidNotes AI — Project Context

## What is this app?
VidNotes AI is a mobile app (React Native / Expo) that turns YouTube videos and playlists into AI-generated study notes. Users study those notes via quizzes, flashcards, and an AI chatbot. Built for students and professionals.

App scheme: `vidnotesai`
Internal name in codebase: `VidNotesAi` (FastAPI title, some older references)

---

## V2 Deferred Features
These are intentionally **not implemented** in v1. Do not add them unless explicitly asked:
- **Redis rate limiting** — current in-memory rate limit is fine for single-worker VPS
- **Separate scheduler worker** — APScheduler runs in the same FastAPI process; acceptable at current scale
- **Image-to-AI in chat** — `image_base64` field exists in the API schema but frontend never sends it
- **`general` chat mode** — defined in `ChatSession.mode` type but not exposed in frontend UI
- **Multiple Uvicorn workers** — single worker on VPS; rate limiting state would need Redis first
- **Empty subject creation** — backend assumes subjects always have topics/notes; breaks generation flow
- **Note moving across subjects/topics** — requires drag-drop UI and reassigning topic/subject foreign keys
- **Offline action queue** — e.g. name changes saved locally and synced on reconnect; not worth complexity for rare actions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native via Expo SDK 54 |
| Routing | Expo Router v6 (file-based) |
| Backend | FastAPI (Python 3.14) + Uvicorn |
| Database & Auth | Supabase (Postgres + RLS + Auth) |
| AI — Primary | Google Gemini (`gemini-2.5-flash`) |
| AI — Fallback | Groq (auto-kicks in on Gemini 429/503/quota errors) |
| Auth | Google OAuth via `expo-auth-session` + Supabase |
| Guest storage | AsyncStorage (`@react-native-async-storage/async-storage`) |
| Styling | NativeWind v4 (Tailwind for RN) |
| Animation | `react-native-reanimated` v4 |
| Gestures | `react-native-gesture-handler` |
| HTTP/Streaming | Native `fetch` (streaming notes) |
| Crypto | `expo-crypto` (UUID generation for guest device ID) |
| TypeScript | Strict mode, `@/*` maps to `frontend/` root |
| Scheduling | APScheduler (note lifecycle — archive at day 25, delete at day 32) |

---

## Repository Structure

```
/
├── CLAUDE.md
├── backend/
│   ├── main.py                    ← FastAPI app, router registration, scheduler start
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env                       ← Never committed — copied to VPS manually via scp
│   ├── db/
│   │   ├── supabase.py            ← Singleton Supabase client (service role key)
│   │   └── api_keys.py            ← Gemini + Groq key rotation + fallback logic
│   ├── dependencies/
│   │   ├── auth.py                ← JWKS singleton, verify_token, verify_token_optional
│   │   └── guest.py               ← check_guest_limit, get_guest_remaining, GUEST_NOTE_LIMIT=3
│   └── services/
│       ├── notes.py               ← /generate/notes, /generate/notes/from-text, /notes/{topic_id}
│       ├── quiz.py                ← /generate/quiz
│       ├── flashcard.py           ← /generate/flashcards
│       ├── daily_quiz.py          ← /generate/daily-quiz
│       ├── chatbot.py             ← /chat/session, /chat/message, /chat/history, /chat/sessions
│       ├── playlist.py            ← /playlist/info, /generate/playlist
│       ├── share.py               ← /share/create, /share/preview, /share/import
│       ├── pdf.py                 ← /api/pdf/notes (export), /api/pdf/extract (upload)
│       ├── devices.py             ← /devices/register
│       ├── scheduler.py           ← APScheduler cron at 2am UTC — archive + delete old notes
│       ├── chunkers.py            ← Transcript chunking + parallel note generation + merge
│       └── queue.py               ← Rate limiter + semaphores, ai_limit dependency
└── frontend/
    ├── app/
    │   ├── _layout.tsx            ← Root layout (auth gate, theme)
    │   ├── index.tsx              ← Entry redirect
    │   ├── modal.tsx              ← Generic modal
    │   ├── (onboarding)/index.tsx ← 5-slide onboarding (first launch only)
    │   ├── auth/login.tsx         ← Fallback login screen
    │   └── (tabs)/
    │       ├── _layout.tsx        ← Bottom tab bar (4 tabs)
    │       ├── index.tsx          ← Home screen
    │       ├── chatbot.tsx        ← Chatbot screen
    │       ├── profile.tsx        ← Profile screen
    │       └── notes/
    │           ├── index.tsx      ← Subjects accordion list
    │           └── [subjectId]/
    │               ├── index.tsx  ← Topics list
    │               └── [topicId].tsx ← Notes list + NoteReader
    ├── components/
    │   ├── ui/                    ← Button, Card, Input, Badge, Modal, LockedFeature
    │   ├── home/                  ← StreakBanner, FeatureGrid, DailyQuiz, GenerateNotesBar, RecentNotes
    │   ├── notes/                 ← SubjectAccordion, TopicItem, NoteCard, NoteReader, GenerateModal
    │   ├── study/                 ← QuizCard, FlashCard
    │   ├── chat/                  ← ChatBubble, ChatInput, ModeSelector
    │   ├── onboarding/            ← OnboardingSlide
    │   └── shared/                ← EmptyState, LoadingSpinner, Avatar
    ├── constants/
    │   ├── colors.ts
    │   ├── typography.ts
    │   ├── spacing.ts
    │   └── layout.ts
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useSubjects.ts
    │   ├── useTopics.ts
    │   ├── useNotes.ts
    │   ├── useQuiz.ts
    │   ├── useFlashCards.ts
    │   ├── useDailyQuiz.ts
    │   ├── useStreak.ts
    │   ├── usePdf.ts
    │   └── useWeakTopics.ts
    ├── lib/api/
    │   ├── client.ts              ← Base fetch helpers, auth headers, token refresh
    │   ├── notes.ts
    │   ├── quiz.ts
    │   ├── flashcards.ts
    │   ├── chat.ts
    │   ├── share.ts
    │   ├── pdf.ts
    │   ├── playlist.ts
    │   └── devices.ts
    ├── services/
    │   ├── auth.ts                ← signInWithGoogle, signOut, getSession
    │   ├── deviceId.ts            ← getOrCreateDeviceId (UUID, AsyncStorage + memory cache)
    │   ├── migration.ts           ← Guest → authenticated data migration on sign-in
    │   ├── notifications.ts
    │   └── storage.ts             ← AsyncStorage CRUD for guest mode
    └── supabase.ts                ← Supabase client (anon key, AsyncStorage session persistence)
```

---

## Backend — Key Patterns

### AI Response Parsing
Always handle both Gemini and Groq response types — Groq kicks in silently as fallback:
```python
text = response.text if hasattr(response, "text") else response.choices[0].message.content
text = text.strip().replace("```json", "").replace("```", "").strip()
```

### Auth (`dependencies/auth.py`)
- `_jwks_client` is a **module-level singleton** — never recreate per request
- `verify_token` — requires valid JWT, raises 401/500
- `verify_token_optional` — returns `None` for missing token, raises 401 for invalid/expired
- `ai_limit` from `queue.py` — use on all AI endpoints instead of `verify_token`

### Rate Limiting (`services/queue.py`)
- In-memory sliding window — resets on server restart (Redis deferred to v2 — single worker on VPS)
- `MAX_CONCURRENT=10` global, `PER_USER_LIMIT=1` per user, `RATE_MAX_REQUESTS=10` per 60s
- `_playlist_semaphore` is separate — playlist jobs don't starve other AI requests
- Use `Depends(ai_limit)` on all heavy routes

### Notes Lifecycle
- Notes expire: warn at day 22, archive at day 25, delete at day 32
- Scheduler runs at 2am UTC via APScheduler cron (same process — separate worker deferred to v2)
- `expires_at = now + 25 days` set on insert
- Transcript capped at **15,000 chars** before storing and before AI call
- Notes per topic hard limit: **7 active notes**

### Chatbot Modes (`services/chatbot.py`)
Three active modes:
- `explain` — tutor, stays within notes
- `quiz` — one question at a time, uses past mistakes from `quiz_attempts`
- `socratic` — guided questioning, never gives answer directly

`general` mode is **deferred to v2** — do not implement or expose in frontend.

`image_base64` field exists in the API schema but **frontend does not send it — reserved for v2**.

### Chunking (`services/chunkers.py`)
- Transcripts over 12,000 chars are split with 500-char overlap
- Chunks processed in parallel (semaphore of 3) then merged in a final Gemini pass
- All logging via `logging` module — never use `print()`

### Guest Mode (Backend)
- `GUEST_NOTE_LIMIT = 3` in `dependencies/guest.py` — single source of truth
- Guest requests identified by `verify_token_optional` returning `None`
- `X-Device-ID` header required for all guest note generation
- Slot reservation is atomic via `check_and_reserve_guest_slot` RPC — no manual increment needed
- `guest.py` exposes only two functions: `check_guest_limit` and `get_guest_remaining` — nothing else

### Share Count (Backend)
- `share_count` on `profiles` is incremented atomically via `increment_profile_share_count` RPC
- Never do read-then-write for counters — always use the RPC

### Ownership Pattern
Consistent across all services — always verify via topic→subject chain:
```python
topic = supabase.table("topics")
    .select("subjects(user_id)")
    .eq("id", topic_id).single().execute()
if not topic.data or topic.data["subjects"]["user_id"] != user["sub"]:
    raise HTTPException(status_code=403, detail="Access denied")
```

### Logging
All backend files use Python's `logging` module — **never `print()`**:
```python
import logging
logger = logging.getLogger(__name__)
logger.info(...)
logger.error(...)
```

### Supabase Client
Always import the singleton — never instantiate directly:
```python
from db.supabase import client as supabase  # ✅
supabase = create_client(...)               # ❌ never do this
```

---

## Deployment

### Infrastructure
- **VPS**: DigitalOcean (shared with friend's app `StatisticallyUOS.tech`)
- **Containerization**: Docker — isolates from friend's app, avoids Python/port conflicts
- **Reverse proxy**: Nginx — routes subdomains to Docker containers
- **SSL/HTTPS**: arnizmangoes.store domain
- **`.env`**: Never in git — copied to VPS once via `scp`, passed to Docker via `env_file`
- **Workers**: Single Uvicorn worker — do not add `--workers N` (breaks in-memory rate limiting)

### Traffic Flow
```
Mobile App
    → HTTPS → Cloudflare (SSL termination)
    → HTTP  → Nginx (VPS, port 80)
             ├── api.vidnotesai.com     → Docker container :8000
             └── api.statisticallyuos.tech → Docker container :8001
```

---

## Frontend — Key Patterns

### API Client (`lib/api/client.ts`)
All requests go through `apiGet`, `apiPost`, `apiDelete`, `apiStream`, `apiPostBlob`.

Error responses parsed as structured JSON:
```typescript
const json = JSON.parse(text);
throw new Error(json.detail ?? text);
```
This makes string matching reliable: `e.message === 'guest_limit_reached'`

Token refresh: if `expires_at` is within 60s, proactively calls `supabase.auth.refreshSession()` before the request.

### Chat API (`lib/api/chat.ts`)
```typescript
startSession(noteIds: string[], mode: 'explain' | 'quiz' | 'socratic')
sendMessage(sessionId, message)   // imageBase64 reserved for v2 — do not pass
getHistory(sessionId)
getSessions()
```

### Playlist API (`lib/api/playlist.ts`)
- Function is `generatePlaylist` (not `streamPlaylist` — renamed, backend returns plain JSON not SSE)
- Events: `topic_done`, `topic_failed`, `playlist_done` (no `topic_start` or `note_chunk`)

### Guest AsyncStorage Keys
All guest keys **must** start with `guest:` so `clearGuestData()` catches them automatically:
```typescript
'guest:notes'           // generated notes
'guest:streak'          // streak data
'guest:pdf_import_used' // PDF import one-time flag
'app:device_id'         // device ID — NOT guest: prefix, persists after sign-in
```

### Migration (`services/migration.ts`)
- Runs on sign-in AND on app relaunch while logged in (inside `getSession()` block)
- `migrationDone` module-level flag prevents double-run
- Migrated notes get `expires_at = now + 25 days` (guest creation time not preserved — intentional)

### Auth States (`useAuth`)
```typescript
isLoading        // initial session check
isGuest          // no session — limited access
isAuthenticated  // full access
```

### Guest Permissions
- ✅ Browse app, onboarding
- ✅ Generate notes from YouTube (saved to AsyncStorage)
- ❌ Quiz, Flashcards, Chatbot — show `LockedFeature` overlay
- ❌ Notes not synced to cloud

---

## Design System

### Colors
```typescript
background:   '#0A0A0F'   // near-black
surface:      '#13131A'   // card backgrounds
border:       '#1E1E2E'   // subtle borders

blue.light:   '#93C5FD'
blue.default: '#4A9EFF'
blue.dark:    '#1D6FD8'

red.light:    '#FCA5A5'
red.default:  '#FF4D6D'
red.dark:     '#C8193A'

text.primary:   '#F8F8FF'
text.secondary: '#A0A0B8'
text.muted:     '#5C5C7A'

success: '#34D399'
warning: '#FBBF24'
error:   '#FF4D6D'

// Feature card tints
notes:      '#1D3461'   // dark blue
quiz:       '#3D1A1A'   // dark red
flashcards: '#1A2D1A'   // dark green
chatbot:    '#2D1A3D'   // dark purple
```

### Typography
- Font: **Inter** via `expo-font`
- Scale: `xs=11, sm=13, md=15, lg=17, xl=20, 2xl=24, 3xl=30`
- Weights: `regular=400, medium=500, semibold=600, bold=700`

### Spacing
`xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48`

### Layout
```typescript
screenPadding: 16
bottomTabHeight: 60
borderRadius: { sm:6, md:12, lg:20, full:9999 }
cardPadding: 16
```

---

## Data Models

```typescript
Subject:  { id, name, description: string|null, created_at }
Topic:    { id, subject_id, name, description: string|null, created_at }
Note:     { id, title, content, status, created_at, updated_at, expires_at }
Flashcard: { front, back }
QuizQuestion: { question, options: {A,B,C,D}, correct: 'A'|'B'|'C'|'D', explanation }
ChatMessage:  { role: 'user'|'assistant', content, created_at }
ChatSession:  { id, title, mode: 'explain'|'quiz'|'socratic', created_at }
```

---

## Backend API Endpoints

Base URL: `process.env.EXPO_PUBLIC_API_URL`
Auth: `Authorization: Bearer <supabase_jwt>` on all authenticated endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/generate/notes` | Optional | Stream AI notes from YouTube URL |
| POST | `/generate/notes/from-text` | Required | Generate notes from pasted text |
| GET | `/notes/:topicId` | Required | Fetch notes for a topic |
| DELETE | `/notes/:noteId` | Required | Soft-delete a note |
| POST | `/generate/quiz` | Required (ai_limit) | Generate MCQ quiz |
| POST | `/generate/flashcards` | Required (ai_limit) | Generate flashcards |
| POST | `/generate/daily-quiz` | Required (ai_limit) | Generate daily quiz question |
| POST | `/chat/session` | Required | Start chat session |
| POST | `/chat/message` | Required (ai_limit) | Send message, get reply |
| GET | `/chat/history/:sessionId` | Required | Get message history |
| GET | `/chat/sessions` | Required | List all sessions |
| POST | `/playlist/info` | Required | Fetch playlist metadata from YouTube |
| POST | `/generate/playlist` | Required (ai_limit) | Generate notes for playlist videos |
| POST | `/share/create` | Required | Create share link |
| GET | `/share/preview/:token` | None | Preview shared notes |
| POST | `/share/import/:token` | Required | Import shared notes |
| POST | `/api/pdf/notes` | Required | Export notes as PDF |
| POST | `/api/pdf/extract` | Required | Extract text from uploaded PDF |
| POST | `/devices/register` | Required | Register push notification device |
| GET | `/health` | None | Health check |

---

## Conventions & Rules

**General**
- All imports use `@/` alias (resolves to `frontend/` root)
- `description` fields are `string | null` — never `undefined` (matches Postgres schema)
- Never use HTML `<form>` tags — use `onPress`/`onChange` RN handlers

**Styling**
- Colors, spacing, typography **always** from `@/constants/*` — never hardcode
- NativeWind v4 for all styling — Tailwind class strings on RN components
- `react-native-reanimated` for animations, `react-native-gesture-handler` for gestures

**Architecture**
- Guest vs authenticated logic lives **inside hooks** — screens just consume hook output
- Streaming: read `res.body` as `ReadableStream` via `.getReader()` — see `useNotes.ts`
- All AI endpoints use `Depends(ai_limit)` not `Depends(verify_token)` directly

**Backend**
- Never instantiate Supabase client directly — always `from db.supabase import client as supabase`
- Always handle both Gemini and Groq response shapes when parsing AI output
- All context passed to AI capped at 15,000 chars
- Ownership always verified via topic→subject→user_id chain before any DB write
- All logging via `logging` module — never `print()`
- Never do read-then-write for DB counters — always use a Supabase RPC
```