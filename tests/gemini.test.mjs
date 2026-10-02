import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateGemini, generateJson } from '../src/ai/gemini.ts';
const originalFetch = globalThis.fetch;
const oldKey = process.env.GEMINI_API_KEY;
const oldGoogleKey = process.env.GOOGLE_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [['GEMINI_API_KEY', oldKey], ['GOOGLE_API_KEY', oldGoogleKey]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
test('sends content and schemas to Google; keeps credentials out of URL', async () => {
  process.env.GEMINI_API_KEY = 'test-only-placeholder';
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(new URL(url).search, '');
    assert.equal(options.headers['x-goog-api-key'], 'test-only-placeholder');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].text, 'analyze these logs');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"analysis":"ok"}' }] } }] });
  };
  assert.deepEqual(await generateJson('analyze these logs', { type: 'OBJECT' }), { analysis: 'ok' });
});
test('preserves inline image response and image request modalities', async () => {
  process.env.GEMINI_API_KEY = 'test-only-placeholder';
  const image = { inlineData: { mimeType: 'image/png', data: 'dGVzdA==' } };
  globalThis.fetch = async (url, options) => {
    assert.match(url, /gemini-3.1-flash-image:generateContent$/);
    assert.deepEqual(JSON.parse(options.body).contents[0].parts, [image]);
    return Response.json({ candidates: [{ content: { parts: [image] } }] });
  };
  assert.deepEqual(await generateGemini([image], { model: 'gemini-3.1-flash-image' }), [image]);
});
test('rejects absent credentials, provider errors, blocked and malformed output', async () => {
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  await assert.rejects(generateGemini([]), /Configure/);
  process.env.GOOGLE_API_KEY = 'test-only-placeholder';
  await assert.rejects(generateGemini([], { model: '../bad?key=oops' }), /Invalid/);
  globalThis.fetch = async () => new Response('sensitive upstream details', { status: 403 });
  await assert.rejects(generateGemini([]), { message: 'Gemini request failed (HTTP 403)' });
  globalThis.fetch = async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } });
  await assert.rejects(generateGemini([]), /did not complete/);
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [] } }] });
  await assert.rejects(generateGemini([]), /no content/);
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] });
  await assert.rejects(generateJson('prompt', {}), SyntaxError);
});
