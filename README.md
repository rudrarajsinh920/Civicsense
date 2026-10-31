# Civicsense

Civicsense is an AI-assisted civic issue reporting prototype built for a Hack Day. Residents describe a local problem in plain words: a pothole, a broken streetlight or a missed garbage pickup. Google's Gemma model suggests a category, a priority and a one-line summary, and reviewers move each report from **submitted** to **under review** to **resolved**.

> **Important:** Civicsense is a prototype. It **does not send reports to any municipal authority**, and nothing in it means a report was received, verified or acted on by a government body. Reports stay in the Civicsense database. AI suggestions are not official decisions, and a person must review them.

## Problem

Small civic problems get lost in the reporting process:

- Residents don't know which department handles what, so complaints arrive vague, duplicated or in the wrong category.
- People who triage complaints spend time reading free text and sorting it before any work can start.
- Residents rarely see what happened after they reported something, so they stop reporting.

## Solution

Civicsense keeps reporting to one short form and does the first sorting step automatically:

1. A resident submits a title, a description and a location. Coordinates are optional.
2. The server sends **only the title and description** to Gemma. Gemma returns a category, a priority and a neutral summary.
3. The report is saved right away. If the AI is down, slow or returns nonsense, the report is still saved with safe defaults.
4. A shared dashboard shows every report, counts by status, and filters by category and status. Reviewers update the status, and marking a report resolved needs confirmation.

## Key features

- **Plain-language reporting** with validation in the browser and on the server.
- **AI triage with Gemma (`gemma-4-26b-a4b-it`):**
  - category: Pothole, Garbage, Water Supply, Streetlight, Drainage or Other;
  - priority: Low, Medium or High;
  - a summary of 25 words or fewer.
  The UI always labels these as AI suggestions.
- **Graceful AI fallback:** if the key is missing, the request times out, the quota runs out or the output is malformed, the report is still saved as Other / Medium with no summary.
- **Dashboard:**
  - a status bar that counts reports and filters by status;
  - category and status filters;
  - expandable report details with a timeline.
- **Reviewer workflow:** submitted, then under review, then resolved, with a confirmation step before resolving. The AI can never change a status.
- **Offline-aware UI:** it checks server health, shows a banner when the server is unreachable, keeps typed form values and reloads by itself when the server comes back.
- **Accessible and responsive:** labelled inputs, keyboard navigation, a visible focus ring, reduced-motion support and a layout that works at 375px.
- **Reproducible demo data:** one command rebuilds a separate demo database.

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, Lucide icons |
| Backend | Node.js 24 (ES modules), Express 5, dotenv, cors |
| Database | SQLite through Node's built-in `node:sqlite` (no ORM, no native add-on) |
| AI | Google Gemma `gemma-4-26b-a4b-it` through the official `@google/genai` SDK |
| Tests | Node's built-in `node:test` runner. The AI is mocked, so tests use no quota. |

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI["React dashboard<br/>(Vite, Tailwind)"]
    end

    subgraph Server["Node.js + Express API"]
        R["/api/reports router<br/>validation"]
        H["/api/health"]
        G["Gemma service<br/>prompt, timeout, retry,<br/>output validation"]
        D["db.js<br/>parameterised SQL"]
    end

    DB[("SQLite file<br/>server/data/*.db")]
    AI["Google Gemma API<br/>gemma-4-26b-a4b-it"]
    ENV[/"server/.env<br/>GOOGLE_API_KEY"/]

    UI -- "fetch JSON (CORS: client origin only)" --> R
    UI -- "poll every 20s" --> H
    R -- "title + description only" --> G
    G -- "HTTPS, JSON mode, 15s timeout" --> AI
    ENV -. "read by server only" .-> G
    R --> D --> DB
```

Flow of `POST /api/reports`:

```mermaid
sequenceDiagram
    participant U as Resident (browser)
    participant API as Express API
    participant AI as Gemma
    participant DB as SQLite
    U->>API: title, description, location
    API->>API: validate (400 if invalid, AI not called)
    API->>AI: title + description
    alt AI answers with valid JSON
        AI-->>API: category, priority, summary
    else error, timeout, quota or malformed output
        API->>API: fall back to Other / Medium / no summary
    end
    API->>DB: INSERT (status = submitted)
    API-->>U: 201 saved report
```

## Database

One table, `reports`, created automatically when the server starts:

| Column | Type | Rule / default |
|--------|------|----------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `title` | TEXT NOT NULL | 120 characters max |
| `description` | TEXT NOT NULL | 2000 characters max |
| `category` | TEXT NOT NULL | default `Other` |
| `priority` | TEXT NOT NULL | default `Medium`; Low / Medium / High |
| `ai_summary` | TEXT | default `NULL` |
| `location` | TEXT NOT NULL | 200 characters max |
| `latitude`, `longitude` | REAL | optional; must be sent together; range-checked |
| `status` | TEXT NOT NULL | default `submitted`; CHECK in (`submitted`, `reviewing`, `resolved`) |
| `created_at`, `updated_at` | TEXT NOT NULL | ISO-8601 UTC |

## API

Base URL: `http://localhost:5000`. Every error is JSON in the form `{ "error": "...", "details"?: { "field": "message" } }`.

| Method | Path | Success | Errors |
|--------|------|---------|--------|
| GET | `/api/health` | 200 `{ status, service, timestamp, uptime }` | |
| POST | `/api/reports` | 201 saved report, including AI suggestions | 400 validation (per-field `details`) or malformed JSON |
| GET | `/api/reports?category=&status=` | 200 array, newest first | 400 invalid status |
| GET | `/api/reports/:id` | 200 report | 400 invalid id, 404 not found |
| PATCH | `/api/reports/:id/status` | 200 updated report | 400 invalid status or id, 404 not found |

The POST body is `{ title, description, location, category?, priority?, latitude?, longitude? }`. The PATCH body is `{ "status": "submitted" | "reviewing" | "resolved" }`.

Example:

```bash
curl -X POST http://localhost:5000/api/reports \
  -H "Content-Type: application/json" \
  -d '{"title":"Deep pothole near the bus depot","description":"Buses swerve to avoid it and it fills with water.","location":"KR Road"}'
```

## Installation and setup

Requirements: **Node.js 24 or newer** (for the built-in `node:sqlite`) and npm.

```bash
npm run install:all
```

Then create the two environment files from the examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Environment variables

`server/.env` (server only, ignored by Git, never commit it):

```dotenv
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
GOOGLE_API_KEY=your-google-ai-studio-key-here
# Optional
# DB_PATH=./data/civicsense.db
# GEMMA_MODEL=gemma-4-26b-a4b-it
```

`client/.env`:

```dotenv
VITE_API_URL=http://localhost:5000
```

- Get a key from Google AI Studio. The key is read **only by the server**. It is never sent to the browser, logged or included in the frontend bundle.
- Without a key, the app still works: reports are saved as Other / Medium with no summary, and the server logs a clear "AI classification disabled" message.

## Running

In two terminals:

```bash
npm run dev:server   # API on http://localhost:5000
```

```bash
npm run dev:client   # dashboard on http://localhost:5173
```

### Demo mode

The demo uses its own database file (`server/data/demo.db`), so it never touches your main data.

```bash
npm run seed:demo    # rebuild demo.db with 8 realistic reports (stop the demo server first)
npm run start:demo   # start the API against demo.db
```

```bash
npm run dev:client
```

The demo reports are fictional. Their category, priority and summary were produced by Gemma once and saved in `server/scripts/demo-reports.json`, so seeding uses no AI quota. Their statuses (submitted, under review, resolved) are Civicsense review states only. They do not mean any authority has acted.

### Production build

```bash
npm run build        # client bundle in client/dist
npm start            # API server
```

## Testing

```bash
npm test
```

There are 21 automated server tests using Node's built-in runner, an in-memory SQLite database and a mocked AI. They use no network and no API quota.

- **API:** validation, defaults, ordering, filters, get by id, status updates and error shapes.
- **AI integration:** suggestions are saved; the reporter's own values win; the AI can't set status; the report is still saved when the key is missing or on timeout, 429 or malformed output; invalid input never calls the AI.
- **Gemma service:** output parsing and normalisation, malformed output, a missing key, no key leakage in errors, retry on 5xx but not 4xx, and timeout.

The frontend has no automated tests. It was checked by hand in a browser; see `PROJECT_STATUS.md`.

## Security notes

- `GOOGLE_API_KEY` lives only in `server/.env`, which is git-ignored. Only `server/src/services/gemma.js` and the startup log check read it.
- AI error messages never include the key or the provider's error body.
- Every SQL statement uses bound parameters. Filters and ids never reach SQL as text.
- All input is validated on the server: required fields, length limits, allowed values, coordinate ranges and integer ids.
- CORS only allows the configured client origin.
- The AI prompt treats report text as data, and its output is validated against fixed lists. Extra fields, such as `status`, are dropped.

## Known limitations

- **No authentication.** Anyone who can reach the API can change a report's status, and status changes are not linked to a reviewer.
- **No rate limiting.** Every report triggers one Gemma call, so a flood of submissions could use up the AI quota. Reports are still saved with defaults.
- **No paging.** The list loads every report.
- **The hosted Gemma API is sometimes slow or flaky.** Calls take about 2–15s, and some return HTTP 500. One retry covers most failures; otherwise the report is saved without AI values, and there is no "re-run AI" action yet.
- **No duplicate detection** for repeated reports of the same issue.
- **Local SQLite only.** The app is not deployed and has no backups.
- **No frontend automated tests.**
- **Reports are not forwarded anywhere.** There is no integration with municipal systems.

## Future improvements

- Reviewer accounts with roles and an audit log of status changes.
- Rate limiting and spam protection on report submission.
- Paging and search on the reports list.
- A "retry AI suggestion" action for reports saved during an AI outage.
- Duplicate and nearby-report detection.
- An optional, explicitly confirmed hand-off to official municipal channels, once agreements with those bodies exist.
- Frontend tests (for example Vitest and Testing Library) and CI.
- Hosted deployment with a managed database and backups.

## Project status

`PROJECT_STATUS.md` holds the step-by-step build log, the verification results and the security review. `HACKATHON.md` has the pitch and the demo script.
