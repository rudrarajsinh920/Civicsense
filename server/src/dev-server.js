import 'dotenv/config';
import { createApp } from './app.js';
import { ensureSchema } from './db.js';
import { connectLocalDb } from './local-db.js';
import { GEMMA_MODEL } from './services/gemma.js';

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const database = await connectLocalDb();
try {
  await ensureSchema();
} catch (err) {
  console.error(`Could not connect to the database: ${err.message}`);
  process.exit(1);
}

createApp({ clientOrigin: CLIENT_ORIGIN }).listen(PORT, () => {
  console.log(`Civicsense API running on http://localhost:${PORT}`);
  console.log(`Allowing requests from ${CLIENT_ORIGIN}`);
  console.log(`Database: ${database}`);
  console.log(
    process.env.GOOGLE_API_KEY
      ? `AI classification: ${process.env.GEMMA_MODEL || GEMMA_MODEL}`
      : 'AI classification disabled: GOOGLE_API_KEY is not set in server/.env (reports use default values)',
  );
});
