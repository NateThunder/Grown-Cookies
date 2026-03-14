# Grown Cookies

Grown Cookies is a `Next.js` storefront and product admin project for a local cookie business. The goal is simple: build something leaner and cheaper to run than a subscription-heavy platform like Shopify, while keeping more control over the catalogue, images, and homepage merchandising.

The project is being built around the next chapter of Lewa Thomas, who previously built Akara Bakery and is now opening a dedicated cookie company.

## Status

This project is not live yet.

It is currently being developed as a working demo and internal toolset. The demo URL is:

`https://growncookies.netlify.app/`

## Why This Repo Exists

Hosted ecommerce platforms are convenient, but they come with recurring costs, platform constraints, and a lot of features that a small local business may not actually need.

This repo is an attempt to keep the stack focused:

- a custom storefront for the brand
- a lightweight admin area for managing products
- Cloudflare services for data and image storage
- lower ongoing running costs than a typical subscription ecommerce setup

## What Is In Here

The codebase currently covers three main areas:

- Public storefront pages built with the App Router in `Next.js`
- Customer account signup using `Supabase Auth`
- An internal product studio at `/admin` for managing catalogue data and homepage featured products

From the code that exists today, the main implemented flows are:

- homepage with featured products
- shop grid and individual product pages
- customer signup with email/password and Google via `Supabase`
- admin sign-in for product management
- product editing backed by `Cloudflare D1`
- product image uploads backed by `Cloudflare R2`
- fallback local product data when Cloudflare is not configured

## Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Supabase Auth` for customer signup and admin authentication
- `Cloudflare D1` for product and featured-product data
- `Cloudflare R2` for product image storage
- `Netlify` for demo hosting

## Running Locally

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env.local
```

3. Add the required environment variables to `.env.local`.

4. Start the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

If you want to use the local vanity domain, add this line to `C:\Windows\System32\drivers\etc\hosts`:

```text
127.0.0.1 local.growncookies.co.uk
```

Then run:

```bash
npm run dev:local
```

and open `http://local.growncookies.co.uk:3000`.

## Environment Variables

Create a `.env.local` file with the following values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_BASE_URL=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_JURISDICTION=
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for customer signup and admin sign-in.
- `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` are required for product management in `/admin`.
- `CLOUDFLARE_R2_BUCKET_NAME` and `CLOUDFLARE_R2_PUBLIC_BASE_URL` are required for serving product images from `R2`.
- `CLOUDFLARE_R2_ACCESS_KEY_ID` and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` are optional if you want to provide explicit `S3`-compatible credentials.
- If explicit `R2` credentials are not set, the app attempts to derive upload credentials from `CLOUDFLARE_API_TOKEN`.
- `CLOUDFLARE_R2_PUBLIC_BASE_URL` should point to the public `R2` hostname or custom domain that serves uploaded product images.

## Supabase Setup

In the `Supabase` dashboard:

1. Enable Email and Google under Authentication providers.
2. Add your local and demo site URLs under URL configuration.
3. For Google login, use the callback URL shown by `Supabase` in the provider setup screen.
4. Decide whether email confirmation should stay enabled.

## Cloudflare Data Model

The admin tooling is built around three tables in `Cloudflare D1`:

- `products`
- `featured_products`
- `product_images`

The schema lives in `cloudflare/d1/schema.sql`.

At the moment, the storefront can still render from local fallback data if `D1` is missing, but `/admin` only works when the Cloudflare environment variables are configured.

## Demo Deployment

This repo is currently intended to run locally during development and to be deployed to `Netlify` for demos.

For a demo deploy, connect the repo to `Netlify` and provide the same environment variables used locally. If `Cloudflare D1`, `Cloudflare R2`, or `Supabase` are missing, parts of the app will degrade or be unavailable, especially `/admin`.

## Project Structure

```text
app/                 Next.js routes and page-level UI
components/          Reusable UI and admin form components
lib/                 Data access, auth helpers, Cloudflare integration
cloudflare/d1/       SQL schema and seed files
public/              Brand assets and product photography
```

## Screenshots

This section is intentionally here so the README can grow with the project.

Suggested screenshots to add later:

- homepage hero and featured products
- shop grid
- product detail page
- admin product studio
- account signup flow

## Notes

This is a focused custom build for a local business, not a generic ecommerce platform. The tradeoff is deliberate: less platform convenience, more control, and lower recurring cost.
