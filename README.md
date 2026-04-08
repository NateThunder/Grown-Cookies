# Grown Cookies Storefront

A custom Next.js storefront for Grown Cookies with product discovery, basket and Stripe checkout, customer accounts, and a lightweight admin studio.

![Homepage screenshot](docs/screenshots/homepage.png)

*Homepage hero and featured products from the current storefront UI.*

## Highlights

- Brand-led homepage and featured product merchandising
- Shop grid, product detail pages, search, and gift card support
- Basket flow and deferred Stripe Elements checkout with server-side confirmation and webhook handling
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
npm run cloudflare:deploy:domain
npm run cloudflare:preview
npm run cloudflare:d1:migrate
```

## Environment

Create `.env.local` with the services this app depends on:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
- Admin security: `ADMIN_LOGIN_THROTTLE_SECRET`
- Checkout security: `CHECKOUT_THROTTLE_SECRET`
- Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Order email notifications: `RESEND_API_KEY`, `ORDER_NOTIFICATION_FROM`, optional `ORDER_NOTIFICATION_TO`
- Contact/order enquiry form: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`, optional `CONTACT_FORM_FROM`, optional `CONTACT_FORM_TO`
- Cloudflare: account/D1/R2 values used by the admin, catalog, and deploy flows

Do not commit `.env.local` or real credentials.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is expected to be public in the browser bundle for Supabase Auth. This app uses Supabase for authentication only; storefront and admin data access in this repo is handled through server-side routes and Cloudflare services, not direct browser table queries.

Set `NEXT_PUBLIC_SITE_URL` to the canonical public origin used by customer auth redirects, for example `https://growncookies.co.uk`. The social OAuth flows and Supabase email confirmation links now prefer this value over browser-origin fallbacks, which prevents production auth from bouncing back to `localhost` when Supabase redirect settings fall back to the project site URL.

Supabase Row Level Security still needs to be verified in the Supabase project itself. This repository does not contain repo-managed Supabase policy files, so confirm in the Supabase dashboard or SQL editor that `anon` and non-admin authenticated users cannot read or mutate any admin-only data.

Admin access is controlled from Supabase user `app_metadata`, not from an environment-variable allowlist. Mark an admin user in Supabase by setting either `role: "admin"`, `user_role: "admin"`, or `is_admin: true` inside that user's `raw_app_meta_data`.

Admin sign-in applies a temporary cooldown after repeated failed attempts and stores only hashed email/IP identifiers in D1. Set `ADMIN_LOGIN_THROTTLE_SECRET` to a long random server-only value before deploying so those hashes are salted consistently across instances.

Checkout payment confirmation now applies a D1-backed attempt throttle before order creation and PaymentIntent creation. Set `CHECKOUT_THROTTLE_SECRET` to a long random server-only value before deploying so hashed checkout identifiers stay stable across instances. If you intentionally want one shared salt, the checkout throttle falls back to `ADMIN_LOGIN_THROTTLE_SECRET`, but a dedicated value is preferred.

Enable Supabase MFA for every admin user in the Supabase dashboard. This repo now hardens the login surface with throttling and browser security headers, but MFA still needs to be enforced in Supabase itself.

Example SQL for the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'adminemail@host.com';
```

## Deployment

Cloudflare deployment now targets Workers via the OpenNext Cloudflare adapter:

```bash
npm run cloudflare:deploy
```

To deploy the production worker and attach the live domains in one command, use:

```bash
npm run cloudflare:deploy:domain
```

Before the first worker deploy, upload runtime secrets from your local environment:

```bash
npx wrangler secret bulk .env.local
```

Before deploying, verify Wrangler auth and token scope requirements in [`cloudflare-upload.md`](cloudflare-upload.md). That guide is the source of truth for authentication, Workers deploy commands, custom-domain attachment, environment variables, and Stripe webhook setup.

Production order notifications are sent after `payment_intent.succeeded` through the Stripe webhook. Configure a verified sender in Resend with `ORDER_NOTIFICATION_FROM`, set `RESEND_API_KEY`, and optionally override the recipient with `ORDER_NOTIFICATION_TO`. If `ORDER_NOTIFICATION_TO` is unset, notifications default to `orders@growncookies.co.uk`.

The `/contact` page now submits server-side and sends through the Zoho Mail API when the Zoho contact-form secrets are set. Configure `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, and `ZOHO_ACCOUNT_ID`, then set `CONTACT_FORM_FROM` if you want a specific Zoho mailbox or alias as the sender. `CONTACT_FORM_TO` remains optional and defaults to `orders@growncookies.co.uk`. If Zoho is unavailable, the route falls back to the existing Resend setup when that is configured.

Local `next dev` can send real contact-form email when either the Zoho Mail API secrets or the Resend fallback secrets are configured.

For D1 schema changes, this repo now includes `wrangler.toml` and migrations in `cloudflare/d1/migrations`. After authenticating with Cloudflare, apply the remote migration with:

```bash
npm run cloudflare:d1:migrate
```

