import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';

export const LOCAL_PGLITE_DIR = fileURLToPath(new URL('../data/pglite', import.meta.url));

// Local tooling only (dev server, seed, migrate); never imported by the Vercel entrypoint.
// With DATABASE_URL set, db.js uses PostgreSQL through pg. Without it, an embedded Postgres
// (PGlite, a dev dependency) stores data in server/data/pglite, so no local install is needed.
export async function connectLocalDb() {
  if (process.env.DATABASE_URL) return 'PostgreSQL (DATABASE_URL)';
  const { PGlite } = await import('@electric-sql/pglite');
  initDb(new PGlite(LOCAL_PGLITE_DIR));
  return `local embedded Postgres (${LOCAL_PGLITE_DIR})`;
}
