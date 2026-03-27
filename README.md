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
npm run cloudflare:d1:migrate
```


```bash
npm run cloudflare:deploy
```

