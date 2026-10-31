// Civicsense PostgreSQL schema. Idempotent (IF NOT EXISTS), so it is safe to run on every cold start.
// Applied by db.js on first use and by `npm run db:migrate`. Kept in JS (not .sql) so it is always
// bundled into the Vercel function. One statement per entry: some drivers reject multi-statement queries.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       TEXT             NOT NULL,
    description TEXT             NOT NULL,
    category    TEXT             NOT NULL DEFAULT 'Other',
    priority    TEXT             NOT NULL DEFAULT 'Medium',
    ai_summary  TEXT                      DEFAULT NULL,
    location    TEXT             NOT NULL,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    status      TEXT             NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted', 'reviewing', 'resolved')),
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at)',
];
