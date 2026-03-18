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
   - `User > Memberships > Read`
   - `Account > Cloudflare Pages > Edit` (and Read if needed)
3. Verify account context matches your target project.

## 2) Deploy to Cloudflare Pages

From repo root:

```bash
npm run cloudflare:deploy
```

This runs:

```bash
npm run cloudflare:build
npx wrangler pages deploy .vercel/output/static --project-name grown-cookies --commit-dirty=true
```

## 3) What to do if deploy fails

- If you still see `Authentication error [code: 10000]`, re-check token scopes above.
- Re-run:

```bash
npx wrangler whoami
npm run cloudflare:build
npx wrangler pages deploy .vercel/output/static --project-name grown-cookies --commit-dirty=true
```

- If needed, switch to fresh user auth:

```bash
npx wrangler logout
npx wrangler login
```

## 4) Environment variables

Set required env values in your Cloudflare Pages project (not just `.env.local`) for runtime features:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`
- `CLOUDFLARE_R2_JURISDICTION`
- `CLOUDFLARE_R2_ACCESS_KEY_ID` (optional)
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (optional)
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 5) Stripe webhook setup

After your Pages deployment is live, add a Stripe webhook endpoint that points to:

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
