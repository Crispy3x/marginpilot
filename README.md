# MarginPilot

eBay dropshipping automation web app. Static pages in `public/`, serverless functions in `api/` (served on Netlify through `netlify/functions/api.mjs`; `vercel.json` also works), accounts and data in Supabase, subscriptions through Whop. No npm dependencies.

## Setup
1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL Editor. Copy the project URL and anon key into `public/config.js`.
2. **Whop**: products MarginPilot Starter / Growth / Pro (3-day $1 trial). Put each plan id (`plan_...`) in `public/config.js`.
3. **Netlify** (free plan allows commercial use): import this repo; `netlify.toml` sets everything. Environment variables:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_…` key from Supabase > Settings > API Keys)
   - `WHOP_WEBHOOK_SECRET` (from the webhook below), `WHOP_PRODUCT_STARTER`, `WHOP_PRODUCT_GROWTH`, `WHOP_PRODUCT_PRO` (`prod_...`)
   - `ANTHROPIC_API_KEY` (set a spend limit in the Anthropic Console), optional `AI_MODEL`, `AI_INPUT_USD_PER_MTOK`, `AI_OUTPUT_USD_PER_MTOK`
4. **Whop webhook**: Developer > Webhooks > `https://<domain>/api/whop-webhook`, events `membership.updated` (and `payment.succeeded`).

## AI allowance
Trial: $1 of AI usage, whatever the tier. Paid: `AI_ALLOWANCE_USD` in `api/_lib.js` (Starter $3, Growth $8, Pro $20 per period — adjust).

## Not built yet
eBay connection (needs an eBay Developer Program app: OAuth, Sell APIs), supplier catalog/stock sync, auto-ordering and tracking upload. The screens show empty states until then.

## Tests
`npm test` (Node 20+).
