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
| Database | PostgreSQL through `pg` (production: a managed provider such as Neon). Local dev and tests use PGlite, an embedded Postgres (dev dependency only). |
| AI | Google Gemma `gemma-4-26b-a4b-it` through the official `@google/genai` SDK |
| Hosting | Vercel, as two projects from this repository: `server` (Express preset) and `client` (Vite) |
| Tests | Node's built-in `node:test` runner with an in-memory PGlite database. The AI is mocked, so tests use no quota. |

## Architecture

```mermaid
flowchart LR
    subgraph FE["Vercel project: client (static)"]
        UI["React dashboard<br/>(Vite, Tailwind)"]
    end

    subgraph BE["Vercel project: server (Express function)"]
        R["/api/reports router<br/>validation"]
        H["/api/health, /api/health/db"]
        G["Gemma service<br/>prompt, timeout, retry,<br/>output validation"]
        D["db.js<br/>pg pool, parameterised SQL"]
    end

    DB[("Managed PostgreSQL<br/>e.g. Neon (SSL)")]
    AI["Google Gemma API<br/>gemma-4-26b-a4b-it"]
    ENV[/"Server env vars<br/>DATABASE_URL, GOOGLE_API_KEY"/]

    UI -- "fetch JSON to VITE_API_BASE_URL<br/>(CORS: CLIENT_ORIGIN only)" --> R
    UI -- "poll every 20s" --> H
    R -- "title + description only" --> G
    G -- "HTTPS, JSON mode, 15s timeout" --> AI
    ENV -. "server only" .-> G
    ENV -. "server only" .-> D
    R --> D --> DB
```

Flow of `POST /api/reports`:

```mermaid
sequenceDiagram
    participant U as Resident (browser)
    participant API as Express API
    participant AI as Gemma
    participant DB as PostgreSQL
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

One PostgreSQL table, `reports`, defined in [`server/src/schema.js`](server/src/schema.js). The schema is idempotent (`IF NOT EXISTS`). It is applied automatically on the first query after a cold start, or explicitly with `npm run db:migrate`.

| Column | Type | Rule / default |
|--------|------|----------------|
| `id` | INTEGER GENERATED ALWAYS AS IDENTITY, primary key | |
| `title` | TEXT NOT NULL | 120 characters max |
| `description` | TEXT NOT NULL | 2000 characters max |
| `category` | TEXT NOT NULL | default `Other` |
| `priority` | TEXT NOT NULL | default `Medium`; Low / Medium / High |
| `ai_summary` | TEXT | default `NULL` |
| `location` | TEXT NOT NULL | 200 characters max |
| `latitude`, `longitude` | DOUBLE PRECISION | optional; must be sent together; range-checked |
| `status` | TEXT NOT NULL | default `submitted`; CHECK in (`submitted`, `reviewing`, `resolved`) |
| `created_at`, `updated_at` | TIMESTAMPTZ NOT NULL | default `now()`; returned by the API as ISO-8601 UTC |

## API

Base URL: `http://localhost:5000`. Every error is JSON in the form `{ "error": "...", "details"?: { "field": "message" } }`.

| Method | Path | Success | Errors |
|--------|------|---------|--------|
| GET | `/api/health` | 200 `{ status, service, timestamp, uptime }` (no database call) | |
| GET | `/api/health/db` | 200 `{ status: "ok", database: "ok" }` | 503 `{ status: "error", database: "unreachable" }` |
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

Requirements: **Node.js 20 or newer** and npm. No local PostgreSQL install is needed. Without `DATABASE_URL`, the server uses an embedded Postgres (PGlite) stored in `server/data/pglite`, which is git-ignored.

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
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require   # optional locally
GOOGLE_API_KEY=your-google-ai-studio-key-here
GEMMA_MODEL=gemma-4-26b-a4b-it
```

`client/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | server only | PostgreSQL connection string, including the provider's SSL setting (`sslmode=require`). Leave it empty locally to use embedded Postgres. |
| `GOOGLE_API_KEY` | server only | Google AI Studio key for Gemma. Without it, reports save as Other / Medium with no summary. |
| `GEMMA_MODEL` | server only | Optional. Defaults to `gemma-4-26b-a4b-it`. |
| `CLIENT_ORIGIN` | server only | Allowed browser origin(s) for CORS, comma-separated, e.g. `https://your-frontend.vercel.app` |
| `VITE_API_BASE_URL` | client, **public** | The API's base URL, built into the JavaScript bundle. Never put a secret in any `VITE_` variable. |

The key and the database URL are read **only by the server**. They are never sent to the browser, logged or included in the frontend bundle.

## Running

In two terminals:

```bash
npm run dev:server   # API on http://localhost:5000
```

```bash
npm run dev:client   # dashboard on http://localhost:5173
```

### Database commands

```bash
npm run db:migrate   # create the schema (idempotent) on DATABASE_URL or the local embedded Postgres
npm run seed:demo    # add the 8 demo reports; skips any that already exist, never deletes
```

Both commands use `DATABASE_URL` if it is set, so they write to that database. Check which database it points to before running them.

The demo reports are fictional. Their category, priority and summary were produced by Gemma once and saved in `server/scripts/demo-reports.json`, so seeding uses no AI quota. Their statuses (submitted, under review, resolved) are Civicsense review states only. They do not mean any authority has acted.

### Production build

```bash
npm run build        # client bundle in client/dist
npm start            # API server (local, non-watch)
```

## Deploying to Vercel

The repository deploys as **two Vercel projects**:

| Project | Root directory | Framework preset | Environment variables |
|---------|----------------|------------------|-----------------------|
| Civicsense API | `server` | Express (auto-detected from `src/index.js`, which default-exports the app) | `DATABASE_URL`, `GOOGLE_API_KEY`, `GEMMA_MODEL`, `CLIENT_ORIGIN` |
| Civicsense Frontend | `client` | Vite | `VITE_API_BASE_URL` = the API project's URL |

1. Create a managed PostgreSQL database, for example on Neon, and copy its **pooled** connection string. It ends with `?sslmode=require`.
2. Deploy the API project, then open `https://<api-url>/api/health` and `https://<api-url>/api/health/db`.
3. Deploy the frontend project with `VITE_API_BASE_URL=https://<api-url>`.
4. Set the API's `CLIENT_ORIGIN` to the frontend's production URL, then redeploy the API.
5. Optional: seed demo data into production from your machine with `DATABASE_URL` set in your shell. Don't put it in a committed file.

`PROJECT_STATUS.md` has the step-by-step checklist.

### Moving data from the old SQLite version

Earlier builds stored reports in `server/data/civicsense.db` (SQLite). That file contains only test reports, so no data migration is needed and nothing is migrated automatically. The file is left in place untouched. Delete it yourself when you no longer need it.

## Testing

```bash
npm test
```

There are 23 automated server tests using Node's built-in runner, an isolated in-memory Postgres (PGlite) and a mocked AI. They never connect to `DATABASE_URL`, and they use no network and no API quota.

- **API:** validation, defaults, ordering, filters, get by id, status updates, error shapes, database health and the CORS origin list.
- **AI integration:** suggestions are saved; the reporter's own values win; the AI can't set status; the report is still saved when the key is missing or on timeout, 429 or malformed output; invalid input never calls the AI.
- **Gemma service:** output parsing and normalisation, malformed output, a missing key, no key leakage in errors, retry on 5xx but not 4xx, and timeout.

The frontend has no automated tests. It was checked by hand in a browser; see `PROJECT_STATUS.md`.

## Security notes

- `GOOGLE_API_KEY` and `DATABASE_URL` live only in server environment variables: `server/.env` locally (git-ignored) and Vercel project settings in production.
  - `GOOGLE_API_KEY` is read only by `server/src/services/gemma.js` and the startup log check.
  - `DATABASE_URL` is read only by `server/src/db.js` and `src/local-db.js`.
- The database check endpoint returns `unreachable` without error details.
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
- **Serverless cold starts.** The first request after an idle period opens a database connection and checks the schema. This adds latency, and Neon's free tier also wakes from auto-suspend.
- **Gemma latency counts toward function time.** Each report waits up to 15s for the AI, within the function's duration limit.
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
- Database backups and point-in-time restore on the managed Postgres plan.

## Project status

`PROJECT_STATUS.md` holds the step-by-step build log, the verification results and the security review. `HACKATHON.md` has the pitch and the demo script.
