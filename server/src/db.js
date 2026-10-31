import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../data/civicsense.db');

export const REPORT_STATUSES = ['submitted', 'reviewing', 'resolved'];

let db;

export function initDb(path = process.env.DB_PATH || DEFAULT_PATH) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'Other',
      priority    TEXT    NOT NULL DEFAULT 'Medium',
      ai_summary  TEXT             DEFAULT NULL,
      location    TEXT    NOT NULL,
      latitude    REAL,
      longitude   REAL,
      status      TEXT    NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'reviewing', 'resolved')),
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at);
  `);
  return db;
}

export function closeDb() {
  db?.close();
  db = undefined;
}

function toReport(row) {
  return row ? { ...row } : null; // node:sqlite rows have a null prototype
}

export function createReport({ title, description, location, category, priority, ai_summary, latitude, longitude }) {
  const now = new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO reports (title, description, location, category, priority, ai_summary, latitude, longitude, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE(?, 'Other'), COALESCE(?, 'Medium'), ?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      description,
      location,
      category ?? null,
      priority ?? null,
      ai_summary ?? null,
      latitude ?? null,
      longitude ?? null,
      now,
      now,
    );
  return getReportById(lastInsertRowid);
}

export function listReports({ category, status } = {}) {
  const where = [];
  const params = [];
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const sql = `SELECT * FROM reports ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY created_at DESC, id DESC`;
  return db.prepare(sql).all(...params).map(toReport);
}

export function getReportById(id) {
  return toReport(db.prepare('SELECT * FROM reports WHERE id = ?').get(id));
}

export function updateReportStatus(id, status) {
  const { changes } = db
    .prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  return changes ? getReportById(id) : null;
}
