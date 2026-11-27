// Netlify entry point: serves /api/* with the same handlers in /api (written in Node req/res style).
// Each request is wrapped so the handler can stream the raw body and write a response as usual.
import me from '../../api/me.js';
import ai from '../../api/ai.js';
import whopWebhook from '../../api/whop-webhook.js';

const ROUTES = { me, ai, 'whop-webhook': whopWebhook };

export async function toNodeCall(handler, request) {
  const bytes = Buffer.from(await request.arrayBuffer());
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const req = {
    method: request.method,
    url: new URL(request.url).pathname,
    headers,
    async *[Symbol.asyncIterator]() { if (bytes.length) yield bytes; },
  };
  return new Promise((resolve, reject) => {
    const out = { status: 200, headers: new Headers() };
    const res = {
      get statusCode() { return out.status; },
      set statusCode(s) { out.status = s; },
      setHeader(k, v) { out.headers.set(k, String(v)); },
      end(body) { resolve(new Response(body ?? null, { status: out.status, headers: out.headers })); },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

export default async (request) => {
  const name = new URL(request.url).pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const handler = ROUTES[name];
  if (!handler) return Response.json({ error: 'Not found' }, { status: 404 });
  try {
    return await toNodeCall(handler, request);
  } catch (e) {
    console.error(`api/${name}:`, e);
    return Response.json({ error: 'Server error. Try again in a minute.' }, { status: 500 });
  }
};

export const config = { path: '/api/*' };
