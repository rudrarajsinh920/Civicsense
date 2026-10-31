import express from 'express';
import cors from 'cors';
import { createReportsRouter } from './routes/reports.js';
import { checkDb } from './db.js';
import { classifyIssue as gemmaClassifyIssue } from './services/gemma.js';

// CLIENT_ORIGIN may list several origins separated by commas (e.g. production + a preview URL).
function parseOrigins(value) {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// classifyIssue is injectable so tests never call the real Gemma API.
export function createApp({ clientOrigin = 'http://localhost:5173', classifyIssue = gemmaClassifyIssue } = {}) {
  const app = express();

  app.use(cors({ origin: parseOrigins(clientOrigin) }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'civicsense-api',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
  });

  // Separate from /api/health so the dashboard's 20s polling never wakes the database.
  app.get('/api/health/db', async (req, res) => {
    try {
      await checkDb();
      res.json({ status: 'ok', database: 'ok' });
    } catch (err) {
      console.error(`Database check failed: ${err.message}`);
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  app.use('/api/reports', createReportsRouter({ classifyIssue }));

  // Unknown API routes return JSON instead of Express's HTML page.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    // Body-parser errors (bad JSON, too large) carry a 4xx status.
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
  });

  return app;
}

// Default app for Vercel (re-exported by src/index.js), configured from the environment.
// Locally, src/dev-server.js calls listen() instead.
export default createApp({ clientOrigin: process.env.CLIENT_ORIGIN || undefined });
