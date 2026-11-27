// The signed-in user's plan and AI usage, for the app's sidebar, paywall and settings.
import { json, userFrom, planFor, allowanceFor, sb } from './_lib.js';

export async function spentSince(userId, since) {
  const q = since ? `&created_at=gte.${encodeURIComponent(since)}` : '';
  const rows = await sb(`ai_calls?user_id=eq.${userId}${q}&select=cost_usd`);
  return (rows || []).reduce((s, r) => s + Number(r.cost_usd || 0), 0);
}

export default async function handler(req, res) {
  const user = await userFrom(req);
  if (!user) return json(res, 401, { error: 'Sign in first.' });
  const plan = await planFor(user.id);
  const allowance = allowanceFor(plan);
  const spent = plan.tier === 'none' ? 0 : await spentSince(user.id, plan.periodStart);
  return json(res, 200, {
    email: user.email,
    plan: plan.tier, trial: plan.trial, status: plan.status,
    ai: { spent_usd: Number(spent.toFixed(4)), allowance_usd: allowance },
  });
}
