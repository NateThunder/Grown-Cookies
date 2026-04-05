# Cloudflare Upload Guide

Use this file for all future deploys to avoid auth/command drift.

## 1) Authenticate with Cloudflare

Run:

```bash
npx wrangler whoami
```

Recommended flow:

1. Prefer user auth with `npx wrangler login` and avoid brittle API token permission edge cases.
2. If you use `CLOUDFLARE_API_TOKEN`, ensure it has:
   - `User > User Details > Read`
   - `User > Memberships > Read`
   - `Account > Account Settings > Read`
   - `Account > Workers Scripts > Edit`
   - `Zone > Workers Routes > Edit`
   - `Account > D1 > Edit` if you run migrations
3. Verify account context matches your target project.

## 2) Bootstrap Worker secrets

From repo root:

```bash
npx wrangler secret bulk .env.local
```

This uploads the runtime values the worker expects from `.env.local`. Re-run it whenever Cloudflare-facing secrets change locally.

## 3) Build and deploy to Cloudflare Workers

From repo root:

```bash
npm run cloudflare:build
npm run cloudflare:deploy
```

These scripts now resolve to:

```bash
opennextjs-cloudflare build
opennextjs-cloudflare deploy -- --keep-vars
```

Use `npm run cloudflare:deploy:domain` to deploy and attach the production domains in the same run:

```bash
npm run cloudflare:deploy:domain
```

This resolves to:

```bash
opennextjs-cloudflare deploy -- --keep-vars --domains growncookies.co.uk --domains www.growncookies.co.uk
```

Cloudflare custom domains cannot be created on a hostname with an existing CNAME record. If a domain attach fails during migration from Pages or another origin, remove the conflicting domain attachment or DNS record first, then rerun the domain deploy.

## 3a) Apply D1 migrations with Wrangler

This repo stores D1 migrations in `cloudflare/d1/migrations` and uses `wrangler.toml` for the database binding.

Before applying migrations:

1. Confirm Wrangler auth with `npx wrangler whoami`.
2. Run:

```bash
npm run cloudflare:d1:migrate
```

This resolves to:

```bash
npx wrangler d1 migrations apply grown-cookies --remote
```

## 4) What to do if deploy fails

- If you still see `Authentication error [code: 10000]`, re-check token scopes above.
- Re-run:

```bash
npx wrangler whoami
npx wrangler secret bulk .env.local
npm run cloudflare:build
npm run cloudflare:deploy
```

- If needed, switch to fresh user auth:

```bash
npx wrangler logout
npx wrangler login
```

If the worker deploy succeeds but `npm run cloudflare:deploy:domain` fails, deploy without domains first, remove the conflicting custom-domain attachment or CNAME in Cloudflare, then rerun the domain deploy.

## 5) Environment variables

Set required env values on the Cloudflare Worker for runtime features. The quickest local bootstrap is `npx wrangler secret bulk .env.local`, but you can also set them in the dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`
- `CLOUDFLARE_R2_JURISDICTION`
- `CLOUDFLARE_R2_ACCESS_KEY_ID` (required for admin product image upload/delete)
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (required for admin product image upload/delete)
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 6) Stripe webhook setup

After your worker deployment is live, add a Stripe webhook endpoint that points to:

```text
https://<your-domain>/api/stripe/webhook
```

Subscribe the endpoint to these events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Then copy the webhook signing secret from Stripe into the Pages environment as:

```text
STRIPE_WEBHOOK_SECRET
```

Use test-mode Stripe keys for preview/test environments and live-mode keys only for production.
