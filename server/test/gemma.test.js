import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiError, classifyIssue, parseClassification, GEMMA_MODEL } from '../src/services/gemma.js';

// Fake SDK client: no network, no API quota.
function fakeClient(generateContent) {
  const calls = [];
  return {
    calls,
    models: {
      generateContent: async (req) => {
        calls.push(req);
        return generateContent(req);
      },
    },
  };
}

const input = { title: 'Pothole on MG Road', description: 'Large pothole damaging bikes' };

test('valid AI output is returned as-is', async () => {
  const client = fakeClient(() => ({ text: '{"category":"Pothole","priority":"High","summary":"Large pothole on MG Road."}' }));
  const result = await classifyIssue(input, { client });
  assert.deepEqual(result, { category: 'Pothole', priority: 'High', summary: 'Large pothole on MG Road.' });

  const [req] = client.calls;
  assert.equal(req.model, GEMMA_MODEL);
  assert.equal(req.model, 'gemma-4-26b-a4b-it');
  assert.equal(req.config.responseMimeType, 'application/json');
  assert.match(req.contents, /Pothole on MG Road/);
});

test('normalises case, strips code fences, trims and caps summary', () => {
  const fenced = '```json\n{"category":"water supply","priority":"low","summary":"  Leak   near  tank. "}\n```';
  assert.deepEqual(parseClassification(fenced), { category: 'Water Supply', priority: 'Low', summary: 'Leak near tank.' });

  // Gemma sometimes wraps the object in an array.
  const wrapped = '[ {"category":"Drainage","priority":"High","summary":"Drain blocked."} ]';
  assert.deepEqual(parseClassification(wrapped), { category: 'Drainage', priority: 'High', summary: 'Drain blocked.' });

  const long = parseClassification(JSON.stringify({ category: 'Garbage', priority: 'Medium', summary: 'x'.repeat(500) }));
  assert.ok(long.summary.length <= 280);
});

test('unknown category/priority and missing summary fall back per field', () => {
  assert.deepEqual(parseClassification('{"category":"Infrastructure","priority":"Urgent"}'), {
    category: 'Other',
    priority: 'Medium',
    summary: null,
  });
  assert.deepEqual(parseClassification('{"category":42,"priority":null,"summary":["a"]}'), {
    category: 'Other',
    priority: 'Medium',
    summary: null,
  });
});

test('extra fields from the model are dropped (cannot set status)', () => {
  const result = parseClassification('{"category":"Drainage","priority":"High","summary":"Blocked drain.","status":"resolved"}');
  assert.deepEqual(Object.keys(result).sort(), ['category', 'priority', 'summary']);
});

test('malformed output throws AiError(malformed)', async () => {
  for (const text of [undefined, '', 'not json', '{"category": "Pothole"', '[1,2]', 'null', '42']) {
    assert.throws(() => parseClassification(text), (e) => e instanceof AiError && e.code === 'malformed', `text=${text}`);
  }
  const client = fakeClient(() => ({ text: 'Sorry, I cannot help.' }));
  await assert.rejects(classifyIssue(input, { client }), { code: 'malformed' });
});

test('missing API key throws a safe config error without calling the API', async () => {
  await assert.rejects(classifyIssue(input, { apiKey: '' }), (e) => {
    assert.equal(e.code, 'config');
    assert.equal(e.message, 'GOOGLE_API_KEY is not configured');
    return true;
  });
});

test('API failure (e.g. quota 429) becomes AiError(api) without leaking details', async () => {
  const client = fakeClient(() => {
    const err = new Error('Resource exhausted. key=SECRET123');
    err.status = 429;
    throw err;
  });
  await assert.rejects(classifyIssue(input, { client }), (e) => {
    assert.equal(e.code, 'api');
    assert.equal(e.message, 'AI request failed (HTTP 429)');
    assert.ok(!e.message.includes('SECRET'));
    return true;
  });
});

test('transient 5xx is retried once; 4xx is not retried', async () => {
  let n = 0;
  const flaky = fakeClient(() => {
    if (n++ === 0) throw Object.assign(new Error('Internal'), { status: 500 });
    return { text: '{"category":"Streetlight","priority":"Medium","summary":"Light out."}' };
  });
  assert.equal((await classifyIssue(input, { client: flaky })).category, 'Streetlight');
  assert.equal(flaky.calls.length, 2);

  const down = fakeClient(() => {
    throw Object.assign(new Error('Internal'), { status: 503 });
  });
  await assert.rejects(classifyIssue(input, { client: down }), { code: 'api', message: 'AI request failed (HTTP 503)' });
  assert.equal(down.calls.length, 2);

  const quota = fakeClient(() => {
    throw Object.assign(new Error('Quota'), { status: 429 });
  });
  await assert.rejects(classifyIssue(input, { client: quota }), { code: 'api' });
  assert.equal(quota.calls.length, 1);
});

test('slow API times out', async () => {
  const client = fakeClient(() => new Promise(() => {})); // never resolves
  const started = Date.now();
  await assert.rejects(classifyIssue(input, { client, timeoutMs: 50 }), { code: 'timeout' });
  assert.ok(Date.now() - started < 1000);
});
