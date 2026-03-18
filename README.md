# Grown Cookies Storefront

**Grown Cookies Storefront** is a custom Next.js ecommerce storefront built for a local cookie brand.  
The app combines a customer-facing shopping experience with a small internal admin workflow for catalog and media management.

This documentation is written for two audiences:

- Recruiters: a concise product-level summary with implementation breadth.
- Engineers: concrete architecture, stack details, routes, and operational notes.

## Status

- In active development
- Demo URL: `https://growncookies.netlify.app/`

## What this app includes

- Public homepage with featured merchandising and brand-first layout
- Shop listing and product detail flow
- Search in listings
- Basket/cart and checkout
- Account and auth entrypoints
- Admin area for product and featured-product editing
- Privacy, legal, FAQ, and data-deletion pages
- Stripe payment flow with intent creation and webhook handling

## Tech stack

- Next.js: `16.1.6`
- React: `19.2.3`
- TypeScript
- Supabase JS: `^2.99.1` (auth + public data reads)
- Stripe: `^5.8.0` (frontend), `^18.4.0` (server)
- AWS SDK S3 client: `^3.1009.0` (R2 upload flow)
- ESLint: `^9`

## Routes / feature map

- `/` — home / featured storefront
- `/shop` — product grid and sorting/filtering
- `/shop/[slug]` — product detail and add-to-basket interactions
- `/cart` — cart management and checkout handoff
- `/checkout` — payment form and order summary
- `/account` — authentication/account entrypoint
- `/contact` — contact flow
- `/admin` — protected admin studio for catalog operations
- `/faqs` — customer FAQs
- `/privacy` — privacy policy
- `/data-deletion` — data deletion/rights flow
- `/api/stripe/payment-intent` — payment intent endpoint
- `/api/stripe/webhook` — Stripe webhook endpoint

## Architecture overview

- **Frontend**: Next.js App Router with mixed Server/Client components
- **Authentication**: Supabase Auth for customer/admin identity flows
- **Catalog persistence**: Cloudflare D1 for products and featured-product data
- **Media storage**: Cloudflare R2 for product images
- **Payments**: Stripe Payment flow with webhook-driven order updates
- **Deployment target**: Cloudflare build/deploy scripts included for pages-style deployment (`npm run cloudflare:build`, `npm run cloudflare:deploy`)

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run cloudflare:build
npm run cloudflare:deploy
```
## Project structure

```text
app/                 Route-level pages and API handlers
components/          Shared UI and page-specific controls
lib/                 Utilities for data, auth, and service integrations
cloudflare/d1/       SQL schema for D1-backed storefront/admin data
public/              Static assets
```

## Screenshots

Add visual examples in this order:

1. Homepage hero and featured section
2. Shop listing cards
3. Product detail page
4. Cart and checkout flow
5. Admin edit screen

## Notes

- The project includes fallback behavior for catalog reads when optional backend services are unavailable, while admin-critical and checkout paths are intentionally more strict.
- This is a practical, lean storefront implementation focused on control, cost, and maintainability compared to hosted monolithic e-commerce platforms.
