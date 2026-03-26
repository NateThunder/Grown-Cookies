# Grown Cookies Storefront

A custom Next.js storefront for Grown Cookies with product discovery, basket and Stripe checkout, customer accounts, and a lightweight admin studio.

![Homepage screenshot](docs/screenshots/homepage.png)

*Homepage hero and featured products from the current storefront UI.*

## Highlights

- Brand-led homepage and featured product merchandising
- Shop grid, product detail pages, search, and gift card support
- Basket flow and Stripe checkout with payment-intent and webhook handling
- Supabase-powered customer sign-in and account area
- Admin editing flow for products and featured storefront content
- Cloudflare-ready deployment path with D1 and R2 integrations

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase Auth for customer and admin identity
- Stripe for checkout and payment reconciliation
- Cloudflare D1 for storefront data
- Cloudflare R2 for media storage

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful scripts:

```bash
npm run build
npm run lint
npm run cloudflare:build
npm run cloudflare:deploy
```

## Environment

Create `.env.local` with the services this app depends on:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Cloudflare: account/D1/R2 values used by the admin, catalog, and deploy flows

Do not commit `.env.local` or real credentials.

Admin access is controlled from Supabase user `app_metadata`, not from an environment-variable allowlist. Mark an admin user in Supabase by setting either `role: "admin"`, `user_role: "admin"`, or `is_admin: true` inside that user's `raw_app_meta_data`.

Example SQL for the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'orders@growncookies.co.uk';
```

## Deployment

Cloudflare Pages deployment is wired through the project scripts:

```bash
npm run cloudflare:deploy
```

Before deploying, verify Wrangler auth and token scope requirements in [`cloudflare-upload.md`](cloudflare-upload.md). That guide is the source of truth for authentication, Pages deploy commands, environment variables, and Stripe webhook setup.
