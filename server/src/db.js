import pg from 'pg';
import { SCHEMA } from './schema.js';

export const REPORT_STATUSES = ['submitted', 'reviewing', 'resolved'];

const COLUMNS =
  'id, title, description, category, priority, ai_summary, location, latitude, longitude, status, created_at, updated_at';

// Any client with query(text, params) -> { rows }: a pg Pool in production, PGlite in tests and local dev.
let client;
let schemaReady;

export function initDb(customClient) {
  client = customClient;
  schemaReady = undefined;
}

// One pool per serverless instance, created on first use. DATABASE_URL is read only here, server-side.
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  // SSL follows the provider's connection string (e.g. Neon's `?sslmode=require`).
  // Small pool + short idle timeout suits serverless instances and pooled endpoints.
  return new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
}

export async function ensureSchema() {
  client ??= createPool();
  schemaReady ??= (async () => {
    for (const statement of SCHEMA) await client.query(statement);
  })().catch((err) => {
    schemaReady = undefined; // retry on the next request instead of caching the failure
    throw err;
  });
  await schemaReady;
  return client;
}

async function query(text, params) {
  const db = await ensureSchema();
  return (await db.query(text, params)).rows;
}

export async function closeDb() {
  await client?.end?.();
  await client?.close?.();
  client = undefined;
  schemaReady = undefined;
}

export async function createReport({ title, description, location, category, priority, ai_summary, latitude, longitude }) {
  const [report] = await query(
    `INSERT INTO reports (title, description, location, category, priority, ai_summary, latitude, longitude)
     VALUES ($1, $2, $3, COALESCE($4, 'Other'), COALESCE($5, 'Medium'), $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [title, description, location, category ?? null, priority ?? null, ai_summary ?? null, latitude ?? null, longitude ?? null],
  );
  return report;
}

export async function listReports({ category, status } = {}) {
  const where = [];
  const params = [];
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  return query(
    `SELECT ${COLUMNS} FROM reports ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC, id DESC`,
    params,
  );
}

export async function getReportById(id) {
  const [report] = await query(`SELECT ${COLUMNS} FROM reports WHERE id = $1`, [id]);
  return report ?? null;
}

export async function updateReportStatus(id, status) {
  const [report] = await query(
    `UPDATE reports SET status = $1, updated_at = now() WHERE id = $2 RETURNING ${COLUMNS}`,
    [status, id],
  );
  return report ?? null;
}

export async function checkDb() {
  await query('SELECT 1');
}
