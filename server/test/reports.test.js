import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { PGlite } from '@electric-sql/pglite';
import { initDb, closeDb } from '../src/db.js';

let server;
let base;

// Mocked AI: tests swap `ai` per case. Default = AI unavailable, so no real API calls.
const aiUnavailable = async () => {
  throw new Error('AI disabled in tests');
};
let ai = aiUnavailable;
let aiCalls = [];

before(async () => {
  initDb(new PGlite()); // isolated in-memory Postgres: tests never touch a real database
  server = createApp({
    classifyIssue: (input) => {
      aiCalls.push(input);
      return ai(input);
    },
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await closeDb();
});

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined || raw ? { 'Content-Type': 'application/json' } : {},
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  return { status: res.status, body: await res.json() };
}

const valid = { title: 'Pothole on Main St', description: 'Deep pothole near the bus stop', location: 'Main St & 3rd Ave' };

test('health endpoint still works', async () => {
  const { status, body } = await api('/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('creates a report with defaults', async () => {
  const { status, body } = await api('/reports', { method: 'POST', body: valid });
  assert.equal(status, 201);
  assert.equal(typeof body.id, 'number');
  assert.equal(body.title, valid.title);
  assert.equal(body.category, 'Other');
  assert.equal(body.priority, 'Medium');
  assert.equal(body.ai_summary, null);
  assert.equal(body.status, 'submitted');
  assert.equal(body.latitude, null);
  assert.ok(body.created_at && body.created_at === body.updated_at);
});

test('creates a report with optional fields and trims text', async () => {
  const { status, body } = await api('/reports', {
    method: 'POST',
    body: { ...valid, title: '  Broken light  ', category: 'Lighting', priority: 'High', latitude: 12.97, longitude: 77.59 },
  });
  assert.equal(status, 201);
  assert.equal(body.title, 'Broken light');
  assert.equal(body.category, 'Lighting');
  assert.equal(body.priority, 'High');
  assert.equal(body.latitude, 12.97);
  assert.equal(body.longitude, 77.59);
});

test('rejects invalid input', async () => {
  const missing = await api('/reports', { method: 'POST', body: { title: '   ' } });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, 'Validation failed');
  assert.deepEqual(Object.keys(missing.body.details).sort(), ['description', 'location', 'title']);

  const bad = await api('/reports', {
    method: 'POST',
    body: { ...valid, priority: 'Critical', latitude: 200, longitude: 'x', title: 'x'.repeat(121) },
  });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.details.priority && bad.body.details.latitude && bad.body.details.longitude && bad.body.details.title);

  const half = await api('/reports', { method: 'POST', body: { ...valid, latitude: 10 } });
  assert.equal(half.status, 400);
  assert.ok(half.body.details.coordinates);

  const array = await api('/reports', { method: 'POST', body: [valid] });
  assert.equal(array.status, 400);

  const malformed = await api('/reports', { method: 'POST', raw: '{not json' });
  assert.equal(malformed.status, 400);
  assert.ok(malformed.body.error);
});

test('lists reports newest first', async () => {
  const { status, body } = await api('/reports');
  assert.equal(status, 200);
  assert.ok(body.length >= 2);
  for (let i = 1; i < body.length; i++) assert.ok(body[i - 1].id > body[i].id);
});

test('filters by category and status', async () => {
  const lighting = await api('/reports?category=Lighting');
  assert.ok(lighting.body.length >= 1);
  assert.ok(lighting.body.every((r) => r.category === 'Lighting'));

  const none = await api('/reports?category=Nope');
  assert.deepEqual(none.body, []);

  const submitted = await api('/reports?status=submitted&category=Other');
  assert.ok(submitted.body.every((r) => r.status === 'submitted' && r.category === 'Other'));

  const badStatus = await api('/reports?status=done');
  assert.equal(badStatus.status, 400);
});

test('gets a report by id; 404 and 400 for bad ids', async () => {
  const created = await api('/reports', { method: 'POST', body: valid });
  const found = await api(`/reports/${created.body.id}`);
  assert.equal(found.status, 200);
  assert.deepEqual(found.body, created.body);

  const missing = await api('/reports/999999');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'Report not found');

  const invalid = await api('/reports/abc');
  assert.equal(invalid.status, 400);
});

test('updates status and updated_at; rejects bad status', async () => {
  const created = await api('/reports', { method: 'POST', body: valid });
  await new Promise((r) => setTimeout(r, 5)); // make updated_at differ

  const updated = await api(`/reports/${created.body.id}/status`, { method: 'PATCH', body: { status: 'reviewing' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, 'reviewing');
  assert.ok(updated.body.updated_at > created.body.updated_at);
  assert.equal(updated.body.created_at, created.body.created_at);

  const bad = await api(`/reports/${created.body.id}/status`, { method: 'PATCH', body: { status: 'closed' } });
  assert.equal(bad.status, 400);

  const empty = await api(`/reports/${created.body.id}/status`, { method: 'PATCH' });
  assert.equal(empty.status, 400);

  const missing = await api('/reports/999999/status', { method: 'PATCH', body: { status: 'resolved' } });
  assert.equal(missing.status, 404);

  const unchanged = await api(`/reports/${created.body.id}`);
  assert.equal(unchanged.body.status, 'reviewing');
});

test('POST saves validated AI suggestions', async () => {
  aiCalls = [];
  ai = async () => ({ category: 'Pothole', priority: 'High', summary: 'Deep pothole near bus stop.' });
  try {
    const { status, body } = await api('/reports', { method: 'POST', body: valid });
    assert.equal(status, 201);
    assert.equal(body.category, 'Pothole');
    assert.equal(body.priority, 'High');
    assert.equal(body.ai_summary, 'Deep pothole near bus stop.');
    assert.equal(body.status, 'submitted');
    // AI only receives title and description, never location.
    assert.deepEqual(aiCalls, [{ title: valid.title, description: valid.description }]);

    const stored = await api(`/reports/${body.id}`);
    assert.deepEqual(stored.body, body);
  } finally {
    ai = aiUnavailable;
  }
});

test('reporter-chosen category/priority win over AI; AI cannot set status', async () => {
  ai = async () => ({ category: 'Garbage', priority: 'Low', summary: 'Summary.', status: 'resolved' });
  try {
    const { body } = await api('/reports', { method: 'POST', body: { ...valid, category: 'Lighting', priority: 'High' } });
    assert.equal(body.category, 'Lighting');
    assert.equal(body.priority, 'High');
    assert.equal(body.ai_summary, 'Summary.');
    assert.equal(body.status, 'submitted');
  } finally {
    ai = aiUnavailable;
  }
});

test('report is still saved with fallbacks when AI fails or times out', async () => {
  const { AiError } = await import('../src/services/gemma.js');
  for (const failure of [
    async () => { throw new AiError('GOOGLE_API_KEY is not configured', 'config'); },
    async () => { throw new AiError('AI request timed out after 15000ms', 'timeout'); },
    async () => { throw new AiError('AI request failed (HTTP 429)', 'api'); },
    async () => { throw new AiError('AI response was not valid JSON', 'malformed'); },
  ]) {
    ai = failure;
    try {
      const { status, body } = await api('/reports', { method: 'POST', body: valid });
      assert.equal(status, 201);
      assert.equal(body.category, 'Other');
      assert.equal(body.priority, 'Medium');
      assert.equal(body.ai_summary, null);
      assert.equal(body.status, 'submitted');
      assert.equal((await api(`/reports/${body.id}`)).status, 200);
    } finally {
      ai = aiUnavailable;
    }
  }
});

test('invalid input is rejected before AI is called', async () => {
  aiCalls = [];
  const { status } = await api('/reports', { method: 'POST', body: { title: 'x' } });
  assert.equal(status, 400);
  assert.equal(aiCalls.length, 0);
});

test('database health check reports ok', async () => {
  const { status, body } = await api('/health/db');
  assert.equal(status, 200);
  assert.deepEqual(body, { status: 'ok', database: 'ok' });
});

test('CORS allows each configured origin and no others', async () => {
  const app = createApp({ clientOrigin: 'https://civicsense.example, https://preview.example/' }).listen(0);
  await new Promise((r) => app.once('listening', r));
  const url = `http://localhost:${app.address().port}/api/health`;
  try {
    for (const origin of ['https://civicsense.example', 'https://preview.example']) {
      const res = await fetch(url, { headers: { Origin: origin } });
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
    }
    const other = await fetch(url, { headers: { Origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  } finally {
    app.close();
  }
});
