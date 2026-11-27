import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { toNodeCall } from '../netlify/functions/api.mjs';
import route from '../netlify/functions/api.mjs';

test('adapter passes raw body, headers and status through', async () => {
  const handler = async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    res.statusCode = 201;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ raw, sig: req.headers['webhook-signature'], method: req.method }));
  };
  const r = await toNodeCall(handler, new Request('https://x.test/api/whop-webhook', {
    method: 'POST', headers: { 'Webhook-Signature': 'v1,abc' }, body: '{"a":1}',
  }));
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { raw: '{"a":1}', sig: 'v1,abc', method: 'POST' });
});

test('unknown route is 404, webhook with bad signature is 401', async () => {
  assert.equal((await route(new Request('https://x.test/api/nope'))).status, 404);
  process.env.WHOP_WEBHOOK_SECRET = 'ws_test';
  const r = await route(new Request('https://x.test/api/whop-webhook', {
    method: 'POST',
    headers: { 'webhook-id': 'm1', 'webhook-timestamp': String(Math.floor(Date.now() / 1000)), 'webhook-signature': 'v1,' + crypto.randomBytes(32).toString('base64') },
    body: '{}',
  }));
  assert.equal(r.status, 401);
});

test('me without sign-in is 401', async () => {
  assert.equal((await route(new Request('https://x.test/api/me'))).status, 401);
});
