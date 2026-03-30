# Security Best Practices Report

Date: 2026-03-30

## Executive summary

The storefront is not trivially broken. The deployed site currently serves a CSP, clickjacking protection, `nosniff`, HTTPS-only transport, and the Stripe webhook verifies signatures over the raw request body. Account APIs also avoid cookie-authenticated JSON calls by requiring bearer tokens, which materially reduces CSRF exposure.

The main remaining risk area is checkout abuse rather than a simple "free money" bug. The public payment-confirmation route can be called without any visible application-layer rate limit, captcha, or velocity control, and it creates pending orders plus Stripe PaymentIntents on each request. That makes the checkout path a realistic target for card-testing pressure, bot spam, and operational noise unless Stripe Radar or upstream edge controls are doing the heavy lifting outside this repository.

## High severity

### GC-001: No visible anti-automation or velocity controls on the public payment-confirmation endpoint

Impact: Attackers can repeatedly hit checkout to generate payment attempts, pending orders, and processor load, which is the exact pattern used in card-testing and payment abuse campaigns.

Evidence:

- [`app/api/stripe/confirm-payment/route.ts:197`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L197) exposes a public `POST` handler.
- [`app/api/stripe/confirm-payment/route.ts:223`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L223) treats authentication as optional for guest checkout.
- [`app/api/stripe/confirm-payment/route.ts:253`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L253) creates a pending order before payment confirmation completes.
- [`app/api/stripe/confirm-payment/route.ts:267`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L267) creates and confirms a Stripe PaymentIntent.
- [`lib/stripe-checkout.ts:126`](E:\Websites\grown-cookies\lib\stripe-checkout.ts#L126) persists every pending order into D1.
- The repo contains login throttling for admin access in [`lib/admin-login-throttle.ts:1`](E:\Websites\grown-cookies\lib\admin-login-throttle.ts#L1), but there is no equivalent throttle, rate limiter, or abuse gate on checkout.

Why this matters:

- This is the control gap most relevant to "stolen cards" and card-testing concerns.
- Even if Stripe declines many abusive attempts, the app still pays the cost of request processing, order creation, and noisy operational data.
- Stripe Radar or Netlify/WAF protections may already help, but that protection is not visible in this codebase and must be verified separately.

Recommended fix:

- Add edge and app-level throttling on `/api/stripe/confirm-payment` keyed by IP, device/session, and optionally basket fingerprint.
- Add velocity checks for repeated attempts across different cards, emails, or shipping data.
- Consider captcha/challenge only after suspicious patterns, not for all users.
- Alert on unusual bursts of failed PaymentIntents and high pending-order creation rates.

## Medium severity

### GC-002: Checkout return URL is accepted from client input without an origin allowlist

Impact: A malicious caller can supply an arbitrary HTTPS origin as the Stripe `return_url`, creating an open-redirect style phishing vector after 3DS or other redirect-based payment steps.

Evidence:

- [`app/api/stripe/confirm-payment/route.ts:49`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L49) only checks that `returnUrlBase` starts with `http://` or `https://`.
- [`app/api/stripe/confirm-payment/route.ts:218`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L218) accepts the user-supplied value.
- [`app/api/stripe/confirm-payment/route.ts:283`](E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts#L283) sends it directly to Stripe as `return_url`.
- The client currently sends `window.location.origin` from [`components/checkout-client.tsx:389`](E:\Websites\grown-cookies\components\checkout-client.tsx#L389), but the server does not enforce that same constraint.

Recommended fix:

- Replace client-provided base URLs with a server-side allowlist, for example a single canonical production origin plus approved local/dev origins.
- Reject any `returnUrlBase` that is not an exact allowed origin.

### GC-003: CSP still allows inline scripts

Impact: The site has a CSP, but `script-src 'unsafe-inline'` weakens its value as an XSS mitigation layer.

Evidence:

- [`next.config.ts:77`](E:\Websites\grown-cookies\next.config.ts#L77) adds `'unsafe-inline'` to `script-src`.
- The live site currently returns `Content-Security-Policy: ... script-src 'self' 'unsafe-inline' https://js.stripe.com ...` on `https://growncookies.netlify.app/` as of 2026-03-30.

Recommended fix:

- Move toward a nonce-based CSP for first-party inline scripts where feasible.
- Keep Stripe on an explicit allowlist, but remove `'unsafe-inline'` once the app no longer depends on it.

## Low severity

### GC-004: Framework fingerprinting via `X-Powered-By`

Impact: This is minor information leakage, but it gives scanners and opportunistic attackers exact framework context.

Evidence:

- The live site currently returns `X-Powered-By: Next.js` on `https://growncookies.netlify.app/` and `https://growncookies.netlify.app/admin` as of 2026-03-30.

Recommended fix:

- Disable `X-Powered-By` in production unless you have a reason to keep it.

## Positive findings

- The live site returns `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and HSTS.
- Admin auth cookies are set `HttpOnly`, `SameSite=Lax`, and `Secure` in production in [`app/admin/actions.ts:217`](E:\Websites\grown-cookies\app\admin\actions.ts#L217).
- The Stripe webhook requires `stripe-signature` and verifies the signature using the raw request body in [`app/api/stripe/webhook/route.ts:27`](E:\Websites\grown-cookies\app\api\stripe\webhook\route.ts#L27).
- Account APIs use bearer-token auth instead of cookie-authenticated JSON requests in [`lib/account-auth.ts:4`](E:\Websites\grown-cookies\lib\account-auth.ts#L4), which avoids the highest-risk CSRF pattern for those endpoints.

## Scope notes

- This review covered repository code and runtime header checks against [growncookies.netlify.app](https://growncookies.netlify.app/) on 2026-03-30.
- I did not perform intrusive testing, payment fraud attempts, credential attacks, or external service configuration inspection.
- Stripe Radar rules, Netlify WAF/rate limiting, Supabase dashboard policies, and Cloudflare edge controls may reduce some of the above risks, but those protections are not visible from this repository alone.
