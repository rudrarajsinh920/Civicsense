// Applies the idempotent schema (src/schema.js) to DATABASE_URL, or to the local embedded Postgres.
import 'dotenv/config';
import { ensureSchema, closeDb } from '../src/db.js';
import { connectLocalDb } from '../src/local-db.js';

const target = await connectLocalDb();
await ensureSchema();
await closeDb();
console.log(`Schema is up to date on ${target}`);
