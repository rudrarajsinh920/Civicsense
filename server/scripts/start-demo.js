// Starts the normal server against the demo database (run `npm run seed:demo` first).
import { DEMO_DB_PATH } from './demo-path.js';

process.env.DB_PATH = DEMO_DB_PATH; // set before dotenv loads; dotenv never overrides existing variables
await import('../src/index.js');
