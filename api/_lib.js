// Shared server helpers. No npm dependencies: Supabase is reached through its REST API with fetch.
//
// Environment variables (set in Vercel > Project > Settings > Environment Variables):
//   SUPABASE_URL               https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  server-only key (never shipped to the browser)
//   WHOP_WEBHOOK_SECRET        ws_... signing secret of the Whop webhook
//   ANTHROPIC_API_KEY          Claude API key (set a spend limit on it in the Anthropic Console)
//   AI_MODEL                   optional, defaults to claude-haiku-5-5
//   AI_INPUT_USD_PER_MTOK / AI_OUTPUT_USD_PER_MTOK   optional price per million tokens, used to meter spend
import crypto from 'node:crypto';

export const env = (k, d) => process.env[k] ?? d;

/** AI allowance per billing period, in USD. The trial cap ($1) is the owner's rule; paid allowances are adjustable. */
export const AI_ALLOWANCE_USD = { trial: 1, starter: 3, growth: 8, pro: 20, none: 0 };

/** Whop product ids -> MarginPilot tier. Set WHOP_PRODUCT_STARTER / _GROWTH / _PRO (prod_...) in Vercel. */
export function tierForProduct(productId) {
  if (!productId) return 'none';
  if (productId === env('WHOP_PRODUCT_PRO')) return 'pro';
  if (productId === env('WHOP_PRODUCT_GROWTH')) return 'growth';
  if (productId === env('WHOP_PRODUCT_STARTER')) return 'starter';
  return 'none';
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Raw request body as a string (needed for webhook signatures). */
// Reads the stream directly and never touches req.body: on Vercel that getter parses JSON and loses the raw bytes.
export async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/** Supabase REST call with the service-role key. */
export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase is not configured');
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json',
      ...(prefer ? { prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** The signed-in Supabase user for a request (Authorization: Bearer <access token>), or null. */
export async function userFrom(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id, email: (u.email || '').toLowerCase() } : null;
}

/**
 * Verify a Whop webhook (Standard Webhooks): HMAC-SHA256 over "<webhook-id>.<webhook-timestamp>.<raw body>",
 * keyed with the ws_ secret exactly as given, base64-encoded, sent as "v1,<sig>" (possibly several, space-separated).
 * Rejects timestamps more than 5 minutes off.
 */
export function verifyWhop(raw, headers, secret, nowSec = Math.floor(Date.now() / 1000)) {
  const id = headers['webhook-id'], ts = headers['webhook-timestamp'], sigHeader = headers['webhook-signature'];
  if (!secret || !id || !ts || !sigHeader || !/^\d+$/.test(ts)) return false;
  if (Math.abs(nowSec - Number(ts)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${id}.${ts}.${raw}`).digest('base64');
  const want = Buffer.from(expected);
  return String(sigHeader).split(' ').some((part) => {
    const sig = part.startsWith('v1,') ? part.slice(3) : '';
    const got = Buffer.from(sig);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
}

/** Cost in USD of one Claude call from its token usage. */
export function costUsd(usage) {
  const inP = Number(env('AI_INPUT_USD_PER_MTOK', '1')), outP = Number(env('AI_OUTPUT_USD_PER_MTOK', '5'));
  return ((usage?.input_tokens || 0) * inP + (usage?.output_tokens || 0) * outP) / 1e6;
}

/** The user's current plan: { tier, trial, status, periodStart }. Missing row = no plan. */
export async function planFor(userId) {
  const rows = await sb(`subscriptions?user_id=eq.${userId}&select=*&order=updated_at.desc&limit=1`);
  const s = rows && rows[0];
  if (!s || !['active', 'trialing', 'past_due', 'completed'].includes(s.status)) {
    return { tier: 'none', trial: false, status: s ? s.status : 'none', periodStart: null };
  }
  return { tier: s.tier, trial: s.status === 'trialing', status: s.status, periodStart: s.period_start };
}

/** AI allowance (USD) for a plan. Trials are capped at AI_ALLOWANCE_USD.trial whatever the tier. */
export function allowanceFor(plan) {
  if (plan.tier === 'none') return 0;
  return plan.trial ? AI_ALLOWANCE_USD.trial : AI_ALLOWANCE_USD[plan.tier] ?? 0;
}
