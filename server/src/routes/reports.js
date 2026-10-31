import { Router } from 'express';
import {
  REPORT_STATUSES,
  createReport,
  getReportById,
  listReports,
  updateReportStatus,
} from '../db.js';

export const PRIORITIES = ['Low', 'Medium', 'High'];

const LIMITS = { title: 120, description: 2000, location: 200, category: 50 };

function badRequest(res, error, details) {
  return res.status(400).json({ error, ...(details && { details }) });
}

function notFound(res) {
  return res.status(404).json({ error: 'Report not found' });
}

// Returns a positive integer id, or null if the param is not one.
function parseId(raw) {
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

function validateReport(body) {
  const errors = {};
  const data = {};

  for (const field of ['title', 'description', 'location']) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (!value) errors[field] = `${field} is required`;
    else if (value.length > LIMITS[field]) errors[field] = `${field} must be at most ${LIMITS[field]} characters`;
    else data[field] = value;
  }

  if (body.category !== undefined && body.category !== null) {
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category || category.length > LIMITS.category) {
      errors.category = `category must be a non-empty string up to ${LIMITS.category} characters`;
    } else data.category = category;
  }

  if (body.priority !== undefined && body.priority !== null) {
    if (!PRIORITIES.includes(body.priority)) errors.priority = `priority must be one of: ${PRIORITIES.join(', ')}`;
    else data.priority = body.priority;
  }

  const hasLat = body.latitude !== undefined && body.latitude !== null;
  const hasLng = body.longitude !== undefined && body.longitude !== null;
  if (hasLat !== hasLng) {
    errors.coordinates = 'latitude and longitude must be provided together';
  } else if (hasLat) {
    const { latitude, longitude } = body;
    if (typeof latitude !== 'number' || !(latitude >= -90 && latitude <= 90)) {
      errors.latitude = 'latitude must be a number between -90 and 90';
    } else data.latitude = latitude;
    if (typeof longitude !== 'number' || !(longitude >= -180 && longitude <= 180)) {
      errors.longitude = 'longitude must be a number between -180 and 180';
    } else data.longitude = longitude;
  }

  return { data, errors: Object.keys(errors).length ? errors : null };
}

// AI suggestions only fill category/priority/ai_summary. They never touch status.
// If AI is unavailable, the report is still saved with the column defaults.
async function aiSuggestions(classifyIssue, data) {
  try {
    return await classifyIssue({ title: data.title, description: data.description });
  } catch (err) {
    console.warn(`AI classification skipped: ${err?.message ?? 'unknown error'}`);
    return null;
  }
}

export function createReportsRouter({ classifyIssue }) {
  const router = Router();

  router.post('/', async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return badRequest(res, 'Request body must be a JSON object');
    }
    const { data, errors } = validateReport(req.body);
    if (errors) return badRequest(res, 'Validation failed', errors);

    const ai = await aiSuggestions(classifyIssue, data);
    // Values the reporter chose explicitly win over AI suggestions.
    const report = createReport({
      ...data,
      category: data.category ?? ai?.category,
      priority: data.priority ?? ai?.priority,
      ai_summary: ai?.summary ?? null,
    });
    res.status(201).json(report);
  });

  router.get('/', (req, res) => {
    const { category, status } = req.query;
    if (category !== undefined && typeof category !== 'string') return badRequest(res, 'category must be a single value');
    if (status !== undefined && !REPORT_STATUSES.includes(status)) {
      return badRequest(res, `status must be one of: ${REPORT_STATUSES.join(', ')}`);
    }
    res.json(listReports({ category, status }));
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, 'Report id must be a positive integer');
    const report = getReportById(id);
    return report ? res.json(report) : notFound(res);
  });

  router.patch('/:id/status', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, 'Report id must be a positive integer');
    const status = req.body?.status;
    if (!REPORT_STATUSES.includes(status)) {
      return badRequest(res, `status must be one of: ${REPORT_STATUSES.join(', ')}`);
    }
    const report = updateReportStatus(id, status);
    return report ? res.json(report) : notFound(res);
  });

  return router;
}
