import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWhop, allowanceFor, costUsd, tierForProduct } from '../api/_lib.js';
import { membershipFields } from '../api/whop-webhook.js';

const secret = 'ws_test_secret';
const sign = (id, ts, body) => 'v1,' + crypto.createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest('base64');

test('accepts a correctly signed Whop webhook', () => {
  const body = '{"type":"membership.updated"}', ts = '1700000000';
  const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, body) };
  assert.equal(verifyWhop(body, headers, secret, 1700000010), true);
});

test('accepts when one of several signatures matches', () => {
  const body = '{}', ts = '1700000000';
  const headers = { 'webhook-id': 'msg_2', 'webhook-timestamp': ts, 'webhook-signature': 'v1,AAAA ' + sign('msg_2', ts, body) };
  assert.equal(verifyWhop(body, headers, secret, 1700000000), true);
});

test('rejects tampered body, wrong secret, old timestamp and missing headers', () => {
  const body = '{"a":1}', ts = '1700000000';
  const good = { 'webhook-id': 'msg_3', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_3', ts, body) };
  assert.equal(verifyWhop('{"a":2}', good, secret, 1700000000), false);
  assert.equal(verifyWhop(body, good, 'ws_other', 1700000000), false);
  assert.equal(verifyWhop(body, good, secret, 1700001000), false);
  assert.equal(verifyWhop(body, {}, secret, 1700000000), false);
  assert.equal(verifyWhop(body, good, '', 1700000000), false);
});

test('trial AI allowance is capped at $1 whatever the tier', () => {
  assert.equal(allowanceFor({ tier: 'pro', trial: true }), 1);
  assert.equal(allowanceFor({ tier: 'starter', trial: true }), 1);
  assert.equal(allowanceFor({ tier: 'growth', trial: false }), 8);
  assert.equal(allowanceFor({ tier: 'none', trial: false }), 0);
});

test('cost is computed from token usage', () => {
  process.env.AI_INPUT_USD_PER_MTOK = '1'; process.env.AI_OUTPUT_USD_PER_MTOK = '5';
  assert.equal(costUsd({ input_tokens: 1_000_000, output_tokens: 200_000 }), 2);
  assert.equal(costUsd(undefined), 0);
});

test('maps Whop products to tiers', () => {
  process.env.WHOP_PRODUCT_GROWTH = 'prod_G';
  assert.equal(tierForProduct('prod_G'), 'growth');
  assert.equal(tierForProduct('prod_unknown'), 'none');
  assert.equal(tierForProduct(undefined), 'none');
});

test('reads membership payload fields', () => {
  const f = membershipFields({ id: 'mem_1', status: 'Trialing', product: { id: 'prod_G' }, plan: { id: 'plan_1' }, user: { id: 'user_1', email: 'A@B.com' }, metadata: { user_id: 'uuid-1' } });
  assert.deepEqual([f.membershipId, f.status, f.productId, f.planId, f.email, f.userId], ['mem_1', 'trialing', 'prod_G', 'plan_1', 'a@b.com', 'uuid-1']);
});
