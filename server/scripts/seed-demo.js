// Rebuilds server/data/demo.db from demo-reports.json. Never touches the main civicsense.db.
// Category, priority and summary in the fixture were produced by Gemma once and frozen, so seeding uses no AI quota.
import { readFileSync, rmSync } from 'node:fs';
import { initDb, closeDb } from '../src/db.js';
import { DEMO_DB_PATH } from './demo-path.js';

const reports = JSON.parse(readFileSync(new URL('./demo-reports.json', import.meta.url), 'utf8'));

try {
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(DEMO_DB_PATH + suffix, { force: true });
} catch (err) {
  console.error(`Could not reset ${DEMO_DB_PATH}. Stop the demo server first. (${err.code})`);
  process.exit(1);
}

const db = initDb(DEMO_DB_PATH);
const insert = db.prepare(
  `INSERT INTO reports (title, description, location, latitude, longitude, category, priority, ai_summary, status, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const HOUR = 3_600_000;
const now = Date.now();
// Oldest first so ids follow creation time.
for (const r of [...reports].sort((a, b) => b.hoursAgo - a.hoursAgo)) {
  const created = now - r.hoursAgo * HOUR;
  // Reviewed reports were last touched partway through their life; submitted ones never changed.
  const updated = r.status === 'submitted' ? created : created + Math.min(r.hoursAgo / 2, 48) * HOUR;
  insert.run(
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
  );
}
closeDb();
console.log(`Seeded ${reports.length} demo reports into ${DEMO_DB_PATH}`);
