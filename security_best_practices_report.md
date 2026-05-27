# Security Best Practices Report

Date: 2026-05-26

## Executive summary

This review covered the live site at `https://growncookies.co.uk/` and the local codebase at `E:\Websites\grown-cookies`. I used non-destructive checks only: live headers/DNS/TLS/status probes, source review, secret hygiene checks, and `npm audit`.

The most urgent issues are operational rather than an obvious unauthenticated data dump: production is running a vulnerable `next` version, Cloudflare is serving the site over plain HTTP and still accepts TLS 1.0/1.1, and the contact form documentation says Turnstile is required but the current implementation never verifies a Turnstile token. The app has several good controls already: admin cookies are `HttpOnly`/`SameSite=Lax`/production `Secure`, admin APIs reject unauthenticated requests, Stripe webhooks verify the raw-body signature, checkout prices are recalculated server-side, and SQL use is centralized through D1 prepared statements.

## High severity

### GC-001: Next.js 16.2.1 is behind multiple current security advisories

Impact: Public Next.js routes may be exposed to known denial-of-service, cache poisoning, middleware/proxy bypass, and SSRF-class issues fixed in later 16.2.x releases.

Evidence:

- `E:\Websites\grown-cookies\package.json:24` pins `next` to `16.2.1`.
- `npm audit --omit=dev --json` reported high-severity advisories for `next`, with a non-major fix available at `16.2.6`.
- Notable advisories from the audit include `GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`, `GHSA-26hh-7cqf-hhc6`, `GHSA-c4j6-fc7j-m34r`, `GHSA-492v-c6pp-mqqv`, and `GHSA-267c-6grr-h53f`.

Recommended fix:

1. Upgrade `next` to `16.2.6` or newer and rebuild/deploy.
2. Re-run `npm audit --omit=dev`, `npm run lint`, `npm run build`, and the checkout/admin smoke tests.
3. Upgrade `@opennextjs/cloudflare` from `1.18.0` to the current compatible `1.19.x` line after the Next patch if the build adapter allows it.

### GC-002: Live transport security allows plaintext HTTP and legacy TLS

Impact: Customers can reach the storefront over plaintext HTTP, and clients can negotiate TLS 1.0/1.1. That weakens confidentiality and integrity for an ecommerce site, especially when users follow `http://` links or sit behind hostile networks.

Evidence:

- `curl http://growncookies.co.uk/` returned `HTTP/1.1 200 OK`, not a redirect to HTTPS.
- Live HTTPS responses did not include `Strict-Transport-Security`.
- A .NET `SslStream` probe negotiated `Tls`, `Tls11`, `Tls12`, and `Tls13` with `growncookies.co.uk`.
- The live certificate itself is valid: `CN=growncookies.co.uk`, Google Trust Services, valid from `2026-04-04` to `2026-07-03`.

Recommended fix:

1. In Cloudflare, enable "Always Use HTTPS" or an equivalent redirect rule for apex and `www`.
2. Set the Cloudflare minimum TLS version to `1.2` at minimum; prefer `1.3` only if you are comfortable dropping older clients.
3. After redirect behavior is verified, add HSTS gradually, for example a short `max-age` first, then increase. Do not preload until you are certain all subdomains are HTTPS-ready.

## Medium severity

### GC-003: Contact form Turnstile protection is documented but not enforced

Impact: Attackers can automate contact submissions up to the app/edge throttles and consume Zoho/Resend quota or flood the inbox. This is not a data breach by itself, but it is a production abuse path.

Evidence:

- `E:\Websites\grown-cookies\README.md:85` says contact submissions require Turnstile before email is sent.
- `E:\Websites\grown-cookies\cloudflare-upload.md:165` says the route verifies Turnstile.
- `E:\Websites\grown-cookies\lib\contact-turnstile.ts:82` implements `verifyContactTurnstileToken`.
- `E:\Websites\grown-cookies\components\contact-order-form.tsx:32` builds a payload with only name/email/phone/subject/message.
- `E:\Websites\grown-cookies\app\api\contact\route.ts:44` exposes the public `POST`, `:69` applies throttle, and `:113`/`:156` send email, but there is no Turnstile verification call.

Recommended fix:

1. Render the Turnstile widget in `components/contact-order-form.tsx` and include the token in the JSON payload.
2. In `app/api/contact/route.ts`, require the token and call `verifyContactTurnstileToken` before `consumeContactAttempt` and before any email send.
3. Fail closed in production when `TURNSTILE_SECRET_KEY` is absent.

### GC-004: CSP still permits inline scripts

Impact: The site has a CSP, but `script-src 'unsafe-inline'` materially reduces CSP's value as an XSS containment layer.

Evidence:

- `E:\Websites\grown-cookies\next.config.ts:85` includes `'unsafe-inline'` in `script-src`.
- Live headers return `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.stripe.com https://www.googletagmanager.com`.
- `style-src 'unsafe-inline'` is also present at `E:\Websites\grown-cookies\next.config.ts:119`; that is less severe than inline script but still worth tracking.

Recommended fix:

1. Move the Google consent/bootstrap script into a nonce-based Next script flow or a static same-origin script.
2. Remove `'unsafe-inline'` from `script-src`; keep Stripe, Turnstile, and GTM sources explicit.
3. Add CSP reporting in report-only mode before enforcing stricter production policy.

### GC-005: Customer account bearer tokens are stored in browser-accessible Supabase session state

Impact: Any future XSS would be able to read the Supabase access token and call account APIs until token expiry. The current app does have CSP and React escaping, but this token storage model raises the blast radius of any frontend injection.

Evidence:

- `E:\Websites\grown-cookies\lib\supabase\client.ts:16` sets `persistSession: true`.
- `E:\Websites\grown-cookies\components\account-page-client.tsx:341` reads the browser session and `:362` extracts `session?.access_token`.
- `E:\Websites\grown-cookies\components\account-page-client.tsx:394` sends that token as `Authorization: Bearer ...`.
- `E:\Websites\grown-cookies\lib\account-auth.ts:14` authenticates API requests from the bearer token.

Recommended fix:

1. Consider moving account auth to Supabase SSR/httpOnly cookie sessions or a backend-for-frontend token exchange.
2. If staying with browser tokens, keep token lifetimes short, remove inline script CSP, and avoid rendering untrusted HTML anywhere.

### GC-006: Admin image uploads rely on client-side type restrictions and file metadata

Impact: An admin-only upload path can store oversized or mislabeled objects in public R2. If an admin account is compromised, or if a browser supplies misleading metadata, the server will trust `file.type` and upload the bytes without content validation.

Evidence:

- `E:\Websites\grown-cookies\components\admin-image-input.tsx:721` limits the browser picker to image MIME types.
- `E:\Websites\grown-cookies\lib\cloudflare-r2.ts:102` only checks that the file is non-empty.
- `E:\Websites\grown-cookies\lib\cloudflare-r2.ts:115` reads the entire upload into memory.
- `E:\Websites\grown-cookies\lib\cloudflare-r2.ts:116` stores `ContentType` from `file.type`.

Recommended fix:

1. Enforce server-side allowlist validation for MIME type and extension.
2. Add a max file size before `arrayBuffer()`.
3. Sniff image magic bytes or decode/re-encode images server-side before public storage.
4. Serve unknown or rejected types as attachment, not inline.

### GC-007: Address search can be abused as an unauthenticated outbound request amplifier

Impact: `/api/address-search` cannot fetch arbitrary hosts, so this is not SSRF, but it can still be automated to generate Nominatim traffic and Worker load.

Evidence:

- `E:\Websites\grown-cookies\app\api\address-search\route.ts:143` exposes an unauthenticated `GET`.
- `E:\Websites\grown-cookies\app\api\address-search\route.ts:149` only requires `q.length >= 3`; there is no maximum length.
- `E:\Websites\grown-cookies\app\api\address-search\route.ts:166` fetches Nominatim with no timeout, app throttle, or cache.

Recommended fix:

1. Add IP/session rate limiting and a short timeout via `AbortController`.
2. Cap query/postcode lengths and reject noisy inputs early.
3. Cache normalized lookup results briefly to reduce repeated upstream calls.

### GC-008: Email authentication DNS is not strict enough for production sender trust

Impact: Spoofing resistance and deliverability are weaker than they should be for order/contact email from `growncookies.co.uk`.

Evidence:

- Live SPF is `v=spf1 include:zohomail.eu ~all`, which uses softfail rather than hardfail.
- Live DMARC is `v=DMARC1; p=quarantine; rua=mailto:yourdomain@yourdomain.com`; the aggregate-report address is a placeholder.
- Zoho DKIM exists at `zmail._domainkey.growncookies.co.uk`.
- No common Resend DKIM record was visible at `resend._domainkey.growncookies.co.uk`, while the app supports Resend through `E:\Websites\grown-cookies\lib\resend-email.ts:12` and requires `ORDER_NOTIFICATION_FROM` at `:17`.

Recommended fix:

1. Replace the DMARC `rua` placeholder with a mailbox you monitor.
2. Move DMARC toward `p=reject` after SPF/DKIM alignment is confirmed.
3. If Resend sends mail from `growncookies.co.uk`, add the exact Resend DKIM/SPF records for the verified sending domain.
4. Consider changing SPF to `-all` once all legitimate senders are included.

## Low severity

### GC-009: Mailing-list signup has no visible abuse control or double opt-in

Impact: Bots can fill the mailing-list table with arbitrary addresses and enumerate duplicate subscriptions via `409`.

Evidence:

- `E:\Websites\grown-cookies\app\api\mailing-list\route.ts:24` exposes an unauthenticated public `POST`.
- `E:\Websites\grown-cookies\app\api\mailing-list\route.ts:33` writes directly after email validation.
- `E:\Websites\grown-cookies\lib\mailing-list.ts:112` uses `INSERT OR IGNORE`, and duplicate attempts surface as a `409` in `app\api\mailing-list\route.ts:41`.

Recommended fix:

1. Add a lightweight throttle/honeypot and consider Turnstile after repeated failures.
2. Use double opt-in before treating an address as subscribed.
3. Return a generic success response for duplicates to avoid subscription enumeration.

### GC-010: Throttle hash secrets have fallback/default behavior

Impact: If D1 throttle tables leak, deterministic fallback secrets make identifier hashes easier to test offline.

Evidence:

- `E:\Websites\grown-cookies\lib\contact-attempt-throttle.ts:88` falls back to `grown-cookies-contact-throttle`.
- `E:\Websites\grown-cookies\lib\checkout-attempt-throttle.ts:103` falls back to `grown-cookies-checkout-throttle`.
- `E:\Websites\grown-cookies\lib\admin-login-throttle.ts:84` can hash with an empty `ADMIN_LOGIN_THROTTLE_SECRET`.

Recommended fix:

1. Require non-empty throttle secrets in production startup/deploy checks.
2. Keep separate secrets for admin login, checkout, and contact throttles.

### GC-011: Missing minor hardening headers and operational discovery files

Impact: These are not urgent compared with the findings above, but they improve browser hardening and vulnerability disclosure workflow.

Evidence:

- Live responses include CSP, `Referrer-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`.
- Live responses did not include `Permissions-Policy`.
- `https://growncookies.co.uk/.well-known/security.txt` returned a Next 404 page.

Recommended fix:

1. Add a minimal `Permissions-Policy`, for example disabling unused high-risk browser features.
2. Add `.well-known/security.txt` with a monitored contact address if you want external researchers to report issues cleanly.

## Positive findings

- `E:\Websites\grown-cookies\app\admin\actions.ts:176` centralizes admin Server Action session checks.
- `E:\Websites\grown-cookies\app\admin\actions.ts:231` sets the admin cookie with `HttpOnly`, `SameSite=Lax`, production `Secure`, path `/`, and a one-hour max age.
- Live `/api/admin/product-image-source?productId=1` and `/api/account/profile` returned `401 Unauthorized` without credentials.
- `E:\Websites\grown-cookies\app\api\admin\gift-cards\route.ts:56` now requires same-origin, JSON content type, a CSRF header, and an admin session before mutation.
- `E:\Websites\grown-cookies\app\api\stripe\webhook\route.ts:75` reads the raw body and `:78` verifies Stripe's webhook signature.
- `E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts:325` and `E:\Websites\grown-cookies\lib\checkout-quote.ts:129` recalculate basket totals from server-side product data before creating a PaymentIntent.
- `E:\Websites\grown-cookies\lib\stripe-customer-payment-methods.ts:97` verifies Stripe payment-method ownership before detach.
- `.env.local` and `.env.worker` are ignored by `.gitignore`; only `.env.example` is tracked.
- I did not find an obvious tracked live secret in the redacted source/log scan.

## Scope notes

- Live checks were against `growncookies.co.uk` and `www.growncookies.co.uk` on 2026-05-26.
- I did not submit live contact forms, attempt payment flows, brute-force credentials, fuzz endpoints, run invasive scanners, or change Cloudflare/Stripe/Supabase dashboard settings.
- Cloudflare WAF/rate-limit rules, Supabase project settings/RLS, Stripe Radar rules, provider-side email settings, and secret rotation history are not fully visible from this repo and need dashboard verification.
