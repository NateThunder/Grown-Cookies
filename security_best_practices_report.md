# Security Best Practices Report

Date: 2026-04-18

## Executive summary

As of 18 April 2026, the live root page at `https://growncookies.co.uk/` is still serving a "Coming soon" page rather than the full storefront. The live response already carries the expected core headers from the repo: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Powered-By` is not exposed.

The biggest remaining launch risks are not a trivial remote takeover of the public storefront. They are operational and blast-radius issues: the public contact form can be abused to send mail without any visible anti-automation control, and the current CSP still permits inline scripts. There is also one admin-only mutation route that uses cookie auth outside the safer Server Action flow. The Cloudflare deploy-token runtime issue has been remediated in repo code/docs, but the live Worker still needs dashboard cleanup and token rotation if the old secret was uploaded.

## High severity

### GC-001: Deploy-scoped Cloudflare credentials were configured for runtime worker use

Status: Remediated in repo code and deployment docs. Operational cleanup is still required in Cloudflare if the old Worker secret exists.

Original impact: If the worker ever suffers any server-side secret disclosure or code-execution issue, the compromise scope expands from "this app" to Cloudflare account-level mutation rights.

Remediation evidence:

- `E:\Websites\grown-cookies\lib\cloudflare-d1.ts` now uses only the Worker `DB` binding and throws when the binding is unavailable.
- `E:\Websites\grown-cookies\cloudflare-upload.md` now uploads runtime secrets from `.env.worker`, excludes deploy-only Cloudflare credentials from Worker runtime, and documents cleanup.
- `E:\Websites\grown-cookies\README.md` now documents Cloudflare deploy credentials as local/CI-only values.

Remaining operational steps:

1. Delete `CLOUDFLARE_API_TOKEN` from the live Worker if present.
2. Delete `CLOUDFLARE_D1_DATABASE_ID` from the live Worker if it was previously bulk-uploaded as a secret.
3. Rotate any Cloudflare API token that was previously loaded into the live Worker.

## Medium severity

### GC-002: Public contact form has no visible anti-abuse control

Impact: Anyone can automate submissions to flood your inbox, consume Zoho/Resend quota, and create operational noise before launch.

Evidence:

- `E:\Websites\grown-cookies\app\api\contact\route.ts:40` exposes an unauthenticated public `POST` handler.
- `E:\Websites\grown-cookies\app\api\contact\route.ts:86` sends through Zoho when configured.
- `E:\Websites\grown-cookies\app\api\contact\route.ts:131` sends through Resend as fallback.
- There is input validation, but there is no rate limit, captcha, honeypot field, or origin check anywhere in this route.

Recommended fix:

1. Add Cloudflare Turnstile to the contact form.
2. Add an app-side throttle keyed by IP and email address, similar to the existing checkout and admin-login throttles.
3. Add a honeypot field and reject obvious bot submissions before sending mail.
4. Log and alert on repeated failures or bursts so abuse is visible before launch day.

### GC-003: CSP still permits inline scripts

Impact: The site has a CSP, but `script-src 'unsafe-inline'` materially weakens CSP as an XSS containment layer.

Evidence:

- `E:\Websites\grown-cookies\next.config.ts:82` adds `'unsafe-inline'` to `script-src`.
- `E:\Websites\grown-cookies\next.config.ts:116` emits that script policy on every route.
- A live header check on 2026-04-18 confirmed the deployed site is still returning `script-src 'self' 'unsafe-inline' ...`.

Recommended fix:

1. Move the consent/bootstrap inline script to a nonce-based or external script flow.
2. Remove `'unsafe-inline'` from `script-src` first; `style-src 'unsafe-inline'` can be handled separately if needed.
3. Add CSP reporting in a non-production or report-only environment while tightening the policy.

## Low severity

### GC-004: Admin gift-card creation route bypasses Server Action origin protections

Impact: This is an admin-only issue, and the current `SameSite=Lax` cookie reduces classic off-site CSRF risk, but the route still performs a state-changing action from a cookie-authenticated Route Handler without explicit origin or CSRF checks.

Evidence:

- `E:\Websites\grown-cookies\app\api\admin\gift-cards\route.ts:10` authenticates purely from the admin cookie.
- `E:\Websites\grown-cookies\app\api\admin\gift-cards\route.ts:30` exposes a state-changing `POST` handler.
- `E:\Websites\grown-cookies\app\api\admin\gift-cards\route.ts:43` creates a gift card after only the cookie-based auth check.

Recommended fix:

1. Prefer a Server Action for this admin mutation so it inherits Next.js origin protections.
2. If it stays a Route Handler, add an explicit Origin check and a CSRF token/header requirement.
3. Keep the admin cookie `SameSite=Lax` or stricter.

### GC-005: Checkout return URL is derived from request origin instead of a strict allowlist

Impact: If the worker is reachable on an unexpected hostname, redirect-based payment flows can send customers back to an unreviewed origin.

Evidence:

- `E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts:115` derives the return origin from `request.url`.
- `E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts:402` sends that derived value directly to Stripe as `return_url`.

Recommended fix:

1. Replace request-derived origins with a small allowlist of known origins such as production, preview, and localhost.
2. Fail closed when the incoming origin is not on that allowlist.

## Positive findings

- `E:\Websites\grown-cookies\app\api\stripe\confirm-payment\route.ts:286` uses a checkout attempt throttle before payment creation.
- `E:\Websites\grown-cookies\next.config.ts:137` disables `X-Powered-By`, and the live site no longer exposes it.
- `.env.local` is not tracked in git, and `E:\Websites\grown-cookies\.gitignore` ignores `.env*` files.
- The live site currently serves a holding page, which reduces the exposed public surface while you finish hardening work.

## Scope notes

- This review covered repository code in `E:\Websites\grown-cookies` and read-only checks against `https://growncookies.co.uk/` on 2026-04-18.
- I did not perform intrusive testing, credential attacks, payment abuse attempts, or destructive actions against the live deployment.
- Cloudflare dashboard settings, Stripe Radar rules, Supabase dashboard policies, and email-provider abuse controls were not visible from this repo and still need separate verification.
