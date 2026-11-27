// Whop -> MarginPilot: keeps each user's plan in sync with their Whop membership.
// Create the webhook in Whop (Developer > Webhooks) pointing at https://<your-domain>/api/whop-webhook,
// subscribed to membership.updated (it also carries activations and deactivations) and payment.succeeded.
import { json, rawBody, verifyWhop, env, sb, tierForProduct } from './_lib.js';

// Vercel: give the handler the raw body so the signature can be checked byte for byte.
export const config = { api: { bodyParser: false } };

const pick = (...xs) => xs.find((x) => x !== undefined && x !== null && x !== '');

/** Pull the fields we need out of a membership payload (tolerant of small shape differences between API versions). */
export function membershipFields(data) {
  const m = data || {};
  return {
    membershipId: pick(m.id, m.membership_id),
    status: String(pick(m.status, '') || '').toLowerCase(),
    productId: pick(m.product?.id, m.product_id, m.access_pass?.id),
    planId: pick(m.plan?.id, m.plan_id),
    email: String(pick(m.user?.email, m.email, '') || '').toLowerCase(),
    whopUserId: pick(m.user?.id, m.user_id),
    userId: pick(m.metadata?.user_id, m.checkout_metadata?.user_id),
    periodStart: pick(m.renewal_period_start, m.current_period_start, m.created_at),
  };
}

async function supabaseUserIdByEmail(email) {
  if (!email) return null;
  const rows = await sb(`profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
  return rows && rows[0] ? rows[0].id : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const raw = await rawBody(req);
  if (!verifyWhop(raw, req.headers, env('WHOP_WEBHOOK_SECRET'))) return json(res, 401, { error: 'bad signature' });

  let event;
  try { event = JSON.parse(raw); } catch { return json(res, 400, { error: 'bad json' }); }
  const type = event.type || event.action || '';

  if (type.startsWith('membership.')) {
    const f = membershipFields(event.data);
    const userId = f.userId || (await supabaseUserIdByEmail(f.email));
    if (!userId || !f.membershipId) return json(res, 200, { ok: true, skipped: 'no matching MarginPilot user' });
    await sb('subscriptions?on_conflict=membership_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: {
        membership_id: f.membershipId, user_id: userId, product_id: f.productId, plan_id: f.planId,
        tier: tierForProduct(f.productId), status: f.status || 'unknown', whop_user_id: f.whopUserId,
        period_start: f.periodStart || new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    });
    return json(res, 200, { ok: true });
  }

  // payment.* and other events need no action yet; acknowledge so Whop does not retry.
  return json(res, 200, { ok: true, ignored: type });
}
