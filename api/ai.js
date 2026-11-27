// AI product research and listing help, metered per user.
// Trial users get at most $1 of Claude usage; paid tiers get their plan's monthly allowance (_lib.js AI_ALLOWANCE_USD).
import { json, userFrom, planFor, allowanceFor, sb, env, costUsd, rawBody } from './_lib.js';
import { spentSince } from './me.js';

const TASKS = {
  research: (input) => `You help an eBay seller who dropships from wholesale suppliers they have agreements with.
Suggest up to 8 product ideas for this request: "${input}".
For each: a short product name, why it sells on eBay, a typical supplier cost range and eBay price range in USD, and the main risk.
Be realistic; never promise income. Reply as plain text, one product per paragraph.`,
  title: (input) => `Write one eBay listing title (max 80 characters) and 5 item specifics for this product: "${input}". No claims you cannot verify.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const user = await userFrom(req);
  if (!user) return json(res, 401, { error: 'Sign in first.' });

  let body = {};
  try { body = JSON.parse(await rawBody(req) || '{}'); } catch { return json(res, 400, { error: 'Bad request.' }); }
  const task = TASKS[body.task] ? body.task : null;
  const input = String(body.input || '').slice(0, 500).trim();
  if (!task || !input) return json(res, 400, { error: 'Say what you want to research.' });

  const plan = await planFor(user.id);
  const allowance = allowanceFor(plan);
  if (allowance <= 0) return json(res, 402, { error: 'Choose a plan to use AI features.', code: 'no_plan' });
  const spent = await spentSince(user.id, plan.periodStart);
  if (spent >= allowance) {
    return json(res, 402, {
      error: plan.trial
        ? 'You have used the $1 of AI included in your trial. Your plan’s full AI allowance starts when the trial ends.'
        : 'You have used this month’s AI allowance for your plan.',
      code: 'ai_cap', spent_usd: spent, allowance_usd: allowance,
    });
  }

  const key = env('ANTHROPIC_API_KEY');
  if (!key) return json(res, 503, { error: 'AI is not configured yet.' });
  // Keep each call well inside what is left of the allowance.
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env('AI_MODEL', 'claude-haiku-5-5'),
      max_tokens: 900,
      messages: [{ role: 'user', content: TASKS[task](input) }],
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json(res, 502, { error: 'The AI service did not answer. Try again in a minute.' });

  const cost = costUsd(out.usage);
  await sb('ai_calls', { method: 'POST', body: { user_id: user.id, task, cost_usd: cost, input_tokens: out.usage?.input_tokens || 0, output_tokens: out.usage?.output_tokens || 0 } });
  const text = (out.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return json(res, 200, { text, ai: { spent_usd: Number((spent + cost).toFixed(4)), allowance_usd: allowance } });
}
