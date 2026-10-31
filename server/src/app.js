import express from 'express';
import cors from 'cors';
import { createReportsRouter } from './routes/reports.js';
import { classifyIssue as gemmaClassifyIssue } from './services/gemma.js';

// classifyIssue is injectable so tests never call the real Gemma API.
export function createApp({ clientOrigin = 'http://localhost:5173', classifyIssue = gemmaClassifyIssue } = {}) {
  const app = express();

  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'civicsense-api',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
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
