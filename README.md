This is a Next.js storefront for Grown Cookies.

## Getting Started

Create a local environment file and add your Supabase project credentials:

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

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

The customer registration screen lives at `/account` and uses Supabase Auth email/password signup.

## Supabase Auth Setup

In the Supabase dashboard:

1. Enable Email auth in Authentication > Providers.
2. Add your local site URL and production URL under Authentication > URL Configuration.
3. Keep email confirmation enabled if you want customers to verify their address before signing in.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

