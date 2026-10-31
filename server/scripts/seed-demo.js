// Adds the 8 fictional demo reports from demo-reports.json to DATABASE_URL (or the local embedded Postgres).
// Idempotent: a demo report is skipped if one with the same title and location already exists.
// It never updates or deletes existing rows. Category, priority and summary were produced by Gemma
// once and frozen in the JSON, so seeding uses no AI quota.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { ensureSchema, closeDb } from '../src/db.js';
import { connectLocalDb } from '../src/local-db.js';

const reports = JSON.parse(readFileSync(new URL('./demo-reports.json', import.meta.url), 'utf8'));
const target = await connectLocalDb();
const db = await ensureSchema();

const HOUR = 3_600_000;
const now = Date.now();
let inserted = 0;
// Oldest first so ids follow creation time.
for (const r of [...reports].sort((a, b) => b.hoursAgo - a.hoursAgo)) {
  const created = now - r.hoursAgo * HOUR;
  // Reviewed reports were last touched partway through their life; submitted ones never changed.
  const updated = r.status === 'submitted' ? created : created + Math.min(r.hoursAgo / 2, 48) * HOUR;
  const { rows } = await db.query(
    `INSERT INTO reports (title, description, location, latitude, longitude, category, priority, ai_summary, status, created_at, updated_at)
     SELECT $1::text, $2::text, $3::text, $4::double precision, $5::double precision, $6::text, $7::text, $8::text, $9::text,
            $10::timestamptz, $11::timestamptz
     WHERE NOT EXISTS (SELECT 1 FROM reports WHERE title = $1::text AND location = $3::text)
     RETURNING id`,
    [
      r.title,
      r.description,
      r.location,
      r.latitude ?? null,
      r.longitude ?? null,
      r.category,
      r.priority,
      r.ai_summary ?? null,
      r.status,
      new Date(created).toISOString(),
      new Date(updated).toISOString(),
    ],
  );
  inserted += rows.length;
}
await closeDb();
console.log(`Demo seed on ${target}: ${inserted} added, ${reports.length - inserted} already present`);
