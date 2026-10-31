import { fileURLToPath } from 'node:url';

export const DEMO_DB_PATH = fileURLToPath(new URL('../data/demo.db', import.meta.url));
