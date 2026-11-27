// Shared browser code: Supabase sign-in, the signed-in user's plan, and the sidebar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const C = window.MP_CONFIG;
export const supabase = createClient(C.supabaseUrl, C.supabaseAnonKey);

export async function session() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Send people who aren't signed in to the sign-in page. */
export async function requireSession() {
  const s = await session();
  if (!s) { location.href = '/login'; return null; }
  return s;
}

/** Call one of our /api endpoints as the signed-in user. */
export async function api(path, body) {
  const s = await session();
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${s?.access_token || ''}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export const money = (n) => '$' + Number(n || 0).toFixed(2);
const TIER = { none: 'No plan', starter: 'Starter', growth: 'Growth', pro: 'Pro' };

/** Render the sidebar into #side and return the user's plan info. */
export async function sidebar(active) {
  const me = (await api('/api/me')).data || {};
  const links = [
    ['dashboard', 'Dashboard', '/app'], ['research', 'Product research', '/app#research'],
    ['listings', 'Listings', '/app#listings'], ['orders', 'Orders', '/app#orders'],
    ['automations', 'Automations', '/app#automations'], ['suppliers', 'Suppliers', '/app#suppliers'],
    ['settings', 'Settings & billing', '/app#settings'],
  ];
  const el = document.getElementById('side');
  const planLabel = me.plan && me.plan !== 'none' ? `${TIER[me.plan]}${me.trial ? ' · $1 trial' : ''}` : 'No plan yet';
  const pct = me.ai && me.ai.allowance_usd ? Math.min(100, (me.ai.spent_usd / me.ai.allowance_usd) * 100) : 0;
  el.innerHTML = `
    <a class="brand" href="/app"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#12B886"/><path d="M7 20 L13 12 L17 16 L23 8" stroke="#0E1726" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>MarginPilot</a>
    <nav aria-label="Main">${links.map(([id, label, href]) => `<a href="${href}" data-id="${id}"${id === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <div class="plan"><div>${planLabel}</div>
      ${me.ai && me.ai.allowance_usd ? `<div>AI used: ${money(me.ai.spent_usd)} of ${money(me.ai.allowance_usd)}</div><div class="bar"><span style="width:${pct}%"></span></div>` : ''}
      ${!me.plan || me.plan === 'none' || me.trial ? '<a class="btn green" href="/pricing">Choose a plan</a>' : ''}
    </div>`;
  return me;
}

export function setActive(id) {
  document.querySelectorAll('#side nav a').forEach((a) => {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/** Escape text before putting it in HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
