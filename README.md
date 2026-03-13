This is a Next.js storefront for Grown Cookies.

## Getting Started

Create a local environment file and add your project credentials:

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_D1_DATABASE_ID=your-cloudflare-d1-database-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_R2_BUCKET_NAME=your-r2-bucket-name
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://your-public-r2-domain-or-custom-domain
```

`CLOUDFLARE_R2_PUBLIC_BASE_URL` must point at the public R2 hostname or custom domain that serves the product images stored in Cloudflare.

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

To use the local vanity domain, add this line to `C:\Windows\System32\drivers\etc\hosts`:

```text
127.0.0.1 local.growncookies.co.uk
```

Then start Next.js bound to all interfaces:

```bash
npm run dev:local
```

Open [http://local.growncookies.co.uk:3000](http://local.growncookies.co.uk:3000).

The customer registration screen lives at `/account` and uses Supabase Auth for email/password signup and Google login.

## Supabase Auth Setup

In the Supabase dashboard:

1. Enable Email and Google in Authentication > Providers.
2. Add your local site URL and production URL under Authentication > URL Configuration.
3. For Google, add the OAuth client ID and secret from Google Cloud, then include the same callback URL Supabase shows in the provider setup screen.
4. Keep email confirmation enabled if you want customers to verify their address before signing in.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
