# Project History

## 2026-04-05
- [done] Created the `payment-gate` branch and prepared the current checkout/admin worktree for push with the `edit payment gate` commit.
- files: HISTORY.md
- status: completed

## 2026-04-05
- [done] Restored a hard client-side timeout for checkout payment confirmation so stalled Stripe confirmation requests no longer leave the pay button stuck on Processing indefinitely.
- files: HISTORY.md, components/checkout-client.tsx
- status: completed

## 2026-04-05
- [done] Disabled active live Stripe keys in the local env and replaced them with empty test-mode placeholders so local checkout testing does not run against production by accident.
- files: HISTORY.md, .env.local
- status: completed

## 2026-04-05
- [done] Fixed the Stripe confirmation-token save-card flow by removing top-level setup-future-usage flags and moving card future-use saving onto per-method PaymentIntent options.
- files: HISTORY.md, app/api/stripe/confirm-payment/route.ts, components/checkout-client.tsx
- status: completed

## 2026-04-04
- [done] Reduced checkout processing stalls by keeping unsaved signed-in card payments off the authenticated saved-card path and adding client-side timeouts for slow Stripe/payment confirmation steps.
- files: HISTORY.md, app/api/stripe/confirm-payment/route.ts, components/checkout-client.tsx
- status: completed

## 2026-04-04
- [done] Fixed Stripe express checkout shipping resolution so Google Pay receives the fixed shipping option and no longer stalls with a pending shipping timeout.
- files: HISTORY.md, components/checkout-client.tsx
- status: completed

## 2026-04-04
- [done] Reduced admin product save revalidation overhead and added explicit submit-pending states so create/save/delete no longer appear stuck while product requests are in flight.
- files: HISTORY.md, app/admin/actions.ts, components/admin-delete-button.tsx, components/admin-product-form.module.css, components/admin-product-form.tsx, components/admin-product-submit.tsx, lib/product-admin.ts
- status: completed

## 2026-04-04
- [done] Fixed the admin create-product insert so new products save successfully instead of failing on the missing sort-order SQL placeholder.
- files: HISTORY.md, lib/product-admin.ts
- status: completed

## 2026-04-04
- [done] Added placeholder R2 access key env entries locally so admin image upload credentials can be filled in for backend CRUD testing.
- files: HISTORY.md, .env.local
- status: completed

## 2026-04-04
- [done] Fixed admin product image upload configuration checks so CRUD image uploads require real Cloudflare R2 S3 credentials instead of incorrectly treating the general API token as valid storage auth.
- files: HISTORY.md, lib/cloudflare-r2.ts, components/admin-image-input.tsx, .env.example, cloudflare-upload.md
- status: completed

## 2026-04-04
- [done] Styled the admin product visibility action so Hide appears red and Show appears green.
- files: HISTORY.md, app/admin/page.tsx, app/admin/page.module.css
- status: completed

## 2026-04-04
- [done] Stopped the admin product hide/show action from reopening the product editor drawer after toggling visibility.
- files: HISTORY.md, app/admin/actions.ts
- status: completed

## 2026-04-04
- [done] Added admin product hide/show controls with a persisted hidden flag so hidden products stay editable in admin but are removed from storefront and homepage product queries.
- files: HISTORY.md, app/admin/actions.ts, app/admin/page.tsx, app/admin/page.module.css, components/admin-product-form.tsx, lib/product-admin.ts, lib/products.ts, cloudflare/d1/schema.sql, cloudflare/d1/migrations/0006_product_hidden_flag.sql
- status: completed

## 2026-04-04
- [done] Fixed customer auth redirect fallbacks so account sign-in/sign-up resolve to the canonical `growncookies.co.uk` origin instead of localhost when the public site URL is missing.
- files: HISTORY.md, components/account-signup-form.tsx, .env.local, README.md
- status: completed

## 2026-04-04
- [done] Added admin product deletion so products can be removed from the CRUD editor, clear homepage Cookie of the Month selection when needed, and clean up stored product images from R2.
- files: HISTORY.md, app/admin/actions.ts, components/admin-product-form.tsx, components/admin-product-form.module.css, lib/cloudflare-r2.ts, lib/product-admin.ts
- status: completed

## 2026-04-04
- [done] Fixed the OpenNext Cloudflare Windows Turbopack chunk inlining patch so server SSR chunks are bundled correctly, then rebuilt and redeployed the Worker custom domains to restore the live site.
- files: HISTORY.md, node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/turbopack.js
- status: completed

## 2026-04-04
- [done] Deployed the latest OpenNext worker build to Cloudflare, synced worker secrets, and investigated custom-domain attachment blockers on `growncookies.co.uk` and `www.growncookies.co.uk`.
- files: HISTORY.md, node_modules/@opennextjs/aws/dist/build/copyTracedFiles.js, node_modules/wrangler/wrangler-dist/cli.js
- status: in_progress

## 2026-04-04
- [done] Switched app-side Cloudflare D1 access to prefer the native Worker `DB` binding, initialized OpenNext Cloudflare dev context in Next config, and ignored generated `.open-next` output in linting.
- files: .env.example, cloudflare-env.d.ts, eslint.config.mjs, lib/cloudflare-d1.ts, next.config.ts, HISTORY.md
- status: completed

## 2026-04-04
- [done] Migrated Cloudflare deployment from deprecated Pages `next-on-pages` to the OpenNext Workers adapter, added Worker deploy/domain scripts, and documented secret/bootstrap and WSL build requirements.
- files: .gitignore, README.md, cloudflare-upload.md, open-next.config.ts, package-lock.json, package.json, wrangler.toml, HISTORY.md
- status: completed

## 2026-03-30
- [done] Refactored the admin routes into a shared shell/context layer, centralized admin nav/query helpers, and removed duplicated admin route chrome.
- files: app/admin/actions.ts, app/admin/admin-page-context.ts, app/admin/admin-ui.ts, app/admin/delivery/page.tsx, app/admin/homepage/page.tsx, app/admin/orders/page.tsx, app/admin/page.module.css, app/admin/page.tsx, components/admin-product-form.tsx, components/admin-shell.tsx, components/admin-sidebar.tsx, HISTORY.md
- status: completed

## 2026-03-30
- [done] Replaced the mobile admin section pills with a right-aligned hamburger toggle and shared the admin sidebar across all admin routes.
- files: app/admin/page.tsx, app/admin/homepage/page.tsx, app/admin/delivery/page.tsx, app/admin/orders/page.tsx, app/admin/page.module.css, components/admin-sidebar.tsx, HISTORY.md
- status: completed

## 2026-03-30
- [done] Reduced admin sign-in latency by reusing Supabase login payload user data, skipping empty throttle cleanup, replacing the main admin page's full orders load with a lightweight order count query, and moving admin/schema reads to fast query-first paths.
- files: app/admin/actions.ts, app/admin/page.tsx, lib/admin-login-throttle.ts, lib/admin-orders.ts, lib/product-admin.ts, lib/store-settings.ts, lib/supabase/admin-auth.ts, HISTORY.md
- status: completed

## 2026-03-30
- [done] Switched customer auth redirects to prefer a canonical public site URL instead of browser-origin localhost fallbacks.
- files: components/account-signup-form.tsx, .env.example, README.md, HISTORY.md
- status: completed

## 2026-03-30
- [done] Hardened checkout payment confirmation with D1-backed attempt throttling, server-derived Stripe return URLs, and disabled framework fingerprinting headers.
- files: .env.example, README.md, app/api/stripe/confirm-payment/route.ts, cloudflare/d1/schema.sql, cloudflare/d1/migrations/0005_checkout_payment_attempts.sql, components/checkout-client.tsx, lib/checkout-attempt-throttle.ts, next.config.ts, HISTORY.md
- status: completed

## 2026-03-30
- [done] Made mobile saved-card payment options horizontally swipeable with a visible scroll hint when the list overflows.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-30
- [done] Added a security review report covering checkout abuse risk, return URL validation, CSP posture, and live-site header observations.
- files: security_best_practices_report.md, HISTORY.md
- status: completed

## 2026-03-30
- [done] Hid the manual checkout delivery fields while a saved address is selected and showed them again when entering a different address.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-30
- [done] Added explicit saved-address selection in checkout for signed-in customers and aligned the account address action copy with save-address wording.
- files: components/checkout-client.tsx, components/checkout-client.module.css, components/account-page-client.tsx, HISTORY.md
- status: completed

## 2026-03-30
- [done] Restored account order-history product names and thumbnails by exposing stored checkout line items to the account API and rendering them in the orders UI.
- files: lib/account-orders.ts, components/account-page-client.tsx, app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-30
- [done] Extended stale-order cleanup to also purge legacy orders already marked expired from D1 during the shared timeout cleanup path.
- files: lib/stripe-checkout.ts, HISTORY.md
- status: completed

## 2026-03-30
- [done] Switched stale pending-order timeout handling from an expired status to full D1 deletion, including cleanup of linked order items and webhook event rows.
- files: app/admin/orders/page.tsx, app/admin/page.module.css, app/account/page.module.css, lib/stripe-checkout.ts, HISTORY.md
- status: completed

## 2026-03-30
- [done] Added global pending-order timeout handling with a 2-minute admin warning state, 5-minute auto-expiry, and paid-only delivery completion controls.
- files: app/admin/orders/page.tsx, app/admin/page.module.css, app/account/page.module.css, lib/admin-orders.ts, lib/account-orders.ts, lib/stripe-checkout.ts, HISTORY.md
- status: completed

## 2026-03-30
- [done] Added an admin Orders sidebar tab with a D1-backed orders table, delivery-status actions, and delivered-at tracking for seller fulfilment.
- files: app/admin/actions.ts, app/admin/page.tsx, app/admin/orders/page.tsx, app/admin/delivery/page.tsx, app/admin/homepage/page.tsx, app/admin/page.module.css, lib/admin-orders.ts, lib/customer-profiles.ts, cloudflare/d1/schema.sql, cloudflare/d1/migrations/0004_order_delivery_tracking.sql, HISTORY.md
- status: completed

## 2026-03-30
- [done] Reduced checkout payment latency by consolidating saved-checkout bootstrap requests and trimming redundant Stripe, Supabase, and D1 work from payment confirmation.
- files: app/api/account/checkout/route.ts, app/api/account/payment-methods/route.ts, app/api/account/payment-methods/setup-intent/route.ts, app/api/stripe/confirm-payment/route.ts, components/checkout-client.tsx, lib/customer-profiles.ts, lib/stripe-checkout.ts, lib/stripe-customer-payment-methods.ts, HISTORY.md
- status: completed

## 2026-03-30
- [done] Matched Stripe checkout confirmation-token setup future usage with the server-side PaymentIntent save-card setting to prevent off-session confirmation mismatches.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-30
- [done] Guarded Stripe checkout/account Payment Elements against premature submission and aligned deferred checkout tokenization with manual payment-method creation.
- files: components/checkout-client.tsx, components/account-page-client.tsx, HISTORY.md
- status: completed

## 2026-03-30
- [done] Fixed the admin add-product modal so its scroll area uses the remaining dialog height and reaches the bottom of the form.
- files: app/admin/page.module.css, HISTORY.md
- status: completed

## 2026-03-30
- [done] Removed the boxed empty-state container from the account Payments section when no saved payment methods exist.
- files: components/account-page-client.tsx, app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-30
- [done] Switched the site favicon to the repository's `favicon.png` asset and removed the default app-router `.ico` override.
- files: app/layout.tsx, app/favicon.ico, HISTORY.md
- status: completed

## 2026-03-30
- [done] Added an account-page Stripe SetupIntent flow so customers can add payment methods directly from the Payments section.
- files: lib/stripe-customer-payment-methods.ts, app/api/account/payment-methods/setup-intent/route.ts, components/account-page-client.tsx, app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-30
- [done] Added signed-in fast checkout with Stripe customer-linked saved cards, checkout prefills, and account payment-method management.
- files: cloudflare/d1/schema.sql, cloudflare/d1/migrations/0003_customer_profile_stripe_customer_id.sql, lib/customer-profiles.ts, lib/saved-payment-methods.ts, lib/stripe-customer-payment-methods.ts, app/api/account/payment-methods/route.ts, app/api/stripe/confirm-payment/route.ts, components/checkout-client.tsx, components/checkout-client.module.css, components/account-page-client.tsx, HISTORY.md
- status: completed

## 2026-03-27
- [done] Reduced storefront latency by batching and caching homepage store-setting reads and deferring basket drawer cart mounting until opened.
- files: lib/store-settings.ts, app/page.tsx, app/admin/homepage/page.tsx, app/admin/actions.ts, components/basket-link.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Replaced the repository README with a recruiter- and engineer-focused storefront overview, route map, stack, scripts, and env/config guidance.
- files: README.md, HISTORY.md
- status: completed

## 2026-03-18
- [done] Hardened README security guidance by adding a secrets-handling section (no real credentials, rotation, secret storage guidance).
- files: README.md, HISTORY.md
- status: completed

## 2026-03-18
- [done] Aligned contact page typography to match FAQ page fonts and text scale.
- files: app/contact/page.module.css, HISTORY.md
- status: completed

This file tracks work completed in the repository for easy machine-readable review.

## 2026-03-18
- [done] Added Stripe express wallet buttons to checkout so Apple Pay and Google Pay can render above the card form when available.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Matched the first FAQ heading size to other FAQ heading sizes.
- files: app/faqs/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Documented the Stripe checkout environment, local webhook testing, and Cloudflare webhook setup steps.
- files: README.md, cloudflare-upload.md, HISTORY.md
- status: completed

## 2026-03-18
- [done] Reformatted the contact page intro copy into clearer content blocks with improved alignment and spacing.
- files: app/contact/page.tsx, app/contact/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Simplified the contact page to a single heading with tighter premium spacing and a more connected form layout.
- files: app/contact/page.tsx, app/contact/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed the white image wrapper outline around checkout summary items.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Increased checkout summary item thumbnail area size in the purple section.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Increased checkout summary item thumbnails further for greater visibility in the purple sidebar.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Increased checkout summary item thumbnails again for larger visual prominence.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Increased only checkout gift-card summary thumbnails to stand out above regular items.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Reduced checkout gift-card summary thumbnails to a smaller size while keeping regular items unchanged.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Made checkout summary image frame a true clip boundary by wrapping item images in a cropped inner container.
- files: components/checkout-client.module.css, components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed inset spacing between checkout summary white outline and item images.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Restored checkout gift-card thumbnail shape behavior while keeping the image frame for normal items.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Excluded gift-card thumbnails from the square crop container while keeping white outline on non-gift summary images.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Filled and cropped checkout gift-card images inside the purple section frame using a dedicated inner frame and absolute fill.
- files: components/checkout-client.module.css, components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added a white outline around checkout summary item images in the purple checkout sidebar.
- files: components/checkout-client.module.css
- status: completed

## 2026-03-18
- [done] Added inner image spacing so checkout summary item thumbnails sit inside the white outline.
- files: components/checkout-client.module.css
- status: completed

## 2026-03-18
- [done] Forced checkout summary image border to render above image content so thumbnails no longer sit on top of the white outline.
- files: components/checkout-client.module.css
- status: completed

## 2026-03-18
- [done] Increased gift card tile size in checkout summary and cart/basket views.
- files: components/checkout-client.module.css, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Increased gift card tile size again in checkout summary and cart/basket views.
- files: components/checkout-client.module.css, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed hover interactions and shadows for gift-card tiles in checkout summary and cart/basket views.
- files: components/checkout-client.module.css, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Matched checkout summary gift-card thumbnails to search styling at a smaller scale.
- files: components/checkout-client.tsx, components/checkout-client.module.css, components/quick-add-button.tsx, components/product-basket-controls.tsx, lib/basket-storage.ts, HISTORY.md
- status: completed

## 2026-03-18
- [done] Made checkout gift-card summary tiles a bit larger and slightly less wide (more square).
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Reduced checkout gift-card summary tile corner rounding.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Applied the same gift-card thumbnail treatment in cart/basket to match checkout summary styling (smaller, less rounded, card-like).
- files: components/cart-client.tsx, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Reduced search modal card widths for gift cards to prevent hover crop.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Fixed search modal gift card hover clipping and image sizing behavior to match home-page card treatment.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed the period from the empty basket empty-state message copy.
- files: components/cart-client.tsx, HISTORY.md
- status: completed

- [done] Removed the empty basket panel outline so the continue shopping state appears unboxed.
- files: components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Disabled the checkout page announcement bar so "Shop our latest arrivals" does not render there.
- files: components/site-header.tsx, app/checkout/page.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Normalized FAQ page base typography so header tagline and latest arrivals banner inherit the same body font treatment as other pages.
- files: app/faqs/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Anchored search modal product fill images to their link wrapper and clipped the wrapper so image content stays inside the card box.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added a white outline around the checkout summary sidebar.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Matched the checkout summary sidebar background to the site footer brand color.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Fixed product card image clicks by making the decorative overlay ignore pointer events so product links work outside quick-add buttons.
- files: app/shop/page.module.css, app/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Made search modal product cards visually card-like by adding border, rounded corners, subtle elevation, and non-square media ratio (while preserving gift-card square treatment).
- files: components/search-modal-trigger.module.css
- status: completed

## 2026-03-18
- [done] Removed the checkout footer "shop" brand label and its unused styling.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed the checkout remember-me section and its unused styling/state.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Increased checkout payment total amount text size in the payment section below tip.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Centered the add-tip stepper plus and minus buttons within their segmented controls.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Moved the payment section below add tip and restored total amount text in the payment area.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Reorganized the checkout add-tip card with a clearer header, grouped custom amount controls, and distinct none/custom selection states.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Changed the desktop checkout purple summary sidebar to scroll with the main form instead of staying sticky.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added extra desktop-only spacing below the checkout summary total inside the purple sidebar to improve scroll behavior.
- files: components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Restored checkout order items to the purple payment summary sidebar for desktop layouts only.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Fixed production build blockers by aligning the webhook Stripe API version and moving checkout success search-param handling to a Next 16-compatible server page.
- files: app/api/stripe/webhook/route.ts, app/checkout/success/page.tsx, components/checkout-success-basket-clearer.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Updated Stripe API version in webhook route to the installed SDK-compatible value.
- files: app/api/stripe/webhook/route.ts, HISTORY.md
- status: completed

## 2026-03-18
- [done] Updated Stripe API version in payment-intent route to the installed SDK-compatible value.
- files: app/api/stripe/payment-intent/route.ts, HISTORY.md
- status: completed

## 2026-03-18
- [done] Switched checkout flow to Stripe Payment Element with server-driven order creation, D1 order persistence, and webhook status reconciliation.
- files: package.json, .env.example, cloudflare-upload.md, cloudflare/d1/schema.sql, lib/stripe-checkout.ts, app/api/stripe/payment-intent/route.ts, app/api/stripe/webhook/route.ts, components/checkout-client.tsx, components/checkout-client.module.css, app/checkout/success/page.tsx, app/checkout/success/page.module.css, app/checkout/cancel/page.tsx, app/checkout/cancel/page.module.css
- status: completed

## 2026-03-18
- [done] Installed missing Stripe frontend/backend packages and updated lockfile to resolve module-not-found build errors.
- files: package.json, package-lock.json, HISTORY.md
- status: completed

## 2026-03-18
- [done] Renamed shipping field label from “Apartment, suite, etc. (optional)” to “Flat number (optional)”.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed
- [done] Cleared all checkout input placeholders/default text so form fields start blank.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed
- [done] Updated checkout email placeholder to "someone@example.com".
- files: components/checkout-client.tsx, HISTORY.md
- status: completed
- [done] Changed checkout email field placeholder text to "email address".
- files: components/checkout-client.tsx, HISTORY.md
- status: completed
- [done] Switched the checkout email field to use placeholder text instead of a prefilled value.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed
- [done] Replaced the hardcoded example checkout email value with "example text".
- files: components/checkout-client.tsx, HISTORY.md
- status: completed
- [done] Removed the checkout order item list from the summary sidebar and left only the delivery fee and total price.
- files: components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Switched the shared mobile header navigation to a hamburger menu drawer while keeping the existing basket trigger styling.
- files: components/site-header.tsx, components/site-header.module.css, components/mobile-nav.tsx, HISTORY.md
- status: completed

## 2026-03-18
- [done] Made each shop product tile open its product page when tapped, while leaving quick-add interactions untouched.
- files: app/shop/page.tsx
- status: completed

## 2026-03-18
- [done] Fixed shop product tile navigation so image clicks navigate to the product page (not only title text), while add-to-cart remains non-navigational.
- files: app/shop/page.tsx
- status: completed

## 2026-03-18
- [done] Removed purple hover tinting from home and shop product tiles while preserving lift and quick-add interactions.
- files: app/page.module.css, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed gradient from the cart checkout CTA and kept a flat background instead.
- files: components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Removed the duplicated subtotal and shipping breakdown block from the basket summary.
- files: components/cart-client.tsx, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Restyled the basket drawer to match the reference with compact item rows, segmented quantity controls, updated subtotal sections, and a refined drawer header.
- files: components/cart-client.tsx, components/cart-client.module.css, components/basket-link.tsx, components/basket-link.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Adjusted shop gift card grid layout so gift-card cards fill the row height and vertically center within their media box.
- files: app/shop/page.module.css
- status: completed

## 2026-03-18
- [done] Updated shop product grid to display 4 columns on desktop, with 3 columns at the 1000px breakpoint.
- files: app/shop/page.module.css
- status: completed

## 2026-03-18
- [done] Applied the same full-height gift card media-box alignment to homepage featured product cards.
- files: app/page.module.css
- status: completed

## 2026-03-18
- [done] Applied updated shop gift card wrapper sizing rules to use explicit full-height inner media wrapper and centered media content.
- files: app/shop/page.module.css
- status: completed

## 2026-03-18
- [done] Aligned shop product grid/card layout with home-page featured grid styling, including card image wrapper, hover effects, and gift-card constraints.
- files: app/shop/page.tsx, app/shop/page.module.css
- status: completed

## 2026-03-18
- [done] Removed the Shop Pay and additional payment option buttons from product pages.
- files: app/shop/[slug]/page.tsx, app/shop/[slug]/page.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Added a client-side basket system with add-to-basket actions, persistent localStorage storage, and a basket page to review items.
- files: lib/basket-storage.ts, components/basket-link.tsx, components/basket-link.module.css, components/product-basket-controls.tsx, components/product-basket-controls.module.css, components/cart-client.tsx, components/cart-client.module.css, app/cart/page.tsx, app/cart/page.module.css, app/shop/[slug]/page.tsx, components/site-header.tsx
- status: completed

## 2026-03-17
- [done] Reworked the basket trigger into a left-slide drawer with backdrop, close behavior, and embedded cart contents.
- files: components/basket-link.tsx, components/basket-link.module.css, components/cart-client.tsx, HISTORY.md
- status: completed

## 2026-03-17
- [done] Removed the top-left background gradients from legal and account pages.
- files: app/legal.module.css, app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Pinned the basket icon as a bottom-right floating action button across the site.
- files: components/basket-link.module.css
- status: completed

## 2026-03-17
- [done] Increased basket icon contrast by updating floating button colors for better visibility in the current color scheme.
- files: components/basket-link.module.css
- status: completed

## 2026-03-17
- [done] Restored top header basket icon while keeping a floating bottom-right basket icon as a second persistent entrypoint.
- files: components/site-header.tsx, components/basket-link.tsx, components/basket-link.module.css
- status: completed

## 2026-03-17
- [done] Added click-outside-close behavior for the shop sort dropdown.
- files: app/shop/page.tsx, app/shop/page.module.css, components/shop-sort-dropdown.tsx
- status: completed

## 2026-03-17
- [done] Prevented shop sort navigation links from resetting scroll position when changing sort order.
- files: app/shop/page.tsx
- status: completed

## 2026-03-17
- [done] Added `HISTORY.md` to record a readable change log for AI/system readers.
- files: HISTORY.md
- status: completed

## 2026-03-18
- [template] Example entry format
- files: AGENTS.md, HISTORY.md
- status: completed

## 2026-03-17
- [done] Added the shop sort dropdown categories and wired the storefront product sorting options.
- files: HISTORY.md, app/shop/page.module.css, app/shop/page.tsx, lib/products.ts
- status: completed

## 2026-03-17
- [done] Removed the closed basket drawer shadow leaking onto the left edge of the page.
- files: components/basket-link.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Switched the basket drawer to slide in from the right side of the screen.
- files: components/basket-link.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Refined the basket quantity controls into a more symmetrical action group with aligned spacing.
- files: components/cart-client.tsx, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Wired hover quick-add controls on listing cards to add products to the basket across home, shop, and search results.
- files: components/quick-add-button.tsx, app/page.tsx, app/page.module.css, app/shop/page.tsx, app/shop/page.module.css, components/search-modal-trigger.tsx, components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Updated the empty basket continue shopping button to use a white background with dark text.
- files: components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-17
- [done] Realigned the shop gift card tile so it sits flush with the product grid instead of being vertically offset.
- files: app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added a Shopify-style checkout page with a live basket summary and linked the cart CTA to the new checkout route.
- files: components/cart-client.tsx, components/cart-client.module.css, components/checkout-client.tsx, components/checkout-client.module.css, app/checkout/page.tsx, app/checkout/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Matched the home page add-to-basket button styling and reveal animation to the shop product grid.
- files: app/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added Cloudflare upload runbook and deployment scripts with AGENTS.md pointer to avoid repeated deployment issues.
- files: AGENTS.md, package.json, cloudflare-upload.md, HISTORY.md
- status: completed

## 2026-03-18
- [done] Centered the gift card tile and text block within the home and shop product grid columns.
- files: app/page.module.css, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Refined the home and shop gift card tile positioning to vertical centering only.
- files: app/page.module.css, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Centered the shop gift card card within its grid cell without changing other product cards.
- files: app/shop/page.tsx, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Wrapped the shop gift card in a full-height invisible image box and centered the card within it vertically.
- files: app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added the shared site navbar to the checkout page and removed the checkout-only top logo header.
- files: app/checkout/page.tsx, app/checkout/page.module.css, components/checkout-client.tsx, components/checkout-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Made search modal cards smaller and rectangular in a compact form with tighter spacing and capped card width (gift cards kept square).
- files: components/search-modal-trigger.module.css
- status: completed


## 2026-03-18
- [done] Adjusted search modal result cards to render as fully visible compact cards by stretching to the grid column, adding a dedicated text area, and tightening spacing so each item appears as a complete card body.
- files: components/search-modal-trigger.module.css
- status: completed

## 2026-03-18
- [done] Made the search modal gift card use the full "Grown Cookies Gift Card" label and keep the full gift-card artwork visible.
- files: components/search-modal-trigger.tsx, components/search-modal-trigger.module.css, components/gift-card-tile.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added a transparent inner frame around the search modal gift card so it sits inside a separate outer result box.
- files: components/search-modal-trigger.tsx, components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Matched the search modal gift card outer media box height to the other product results so the text lines up.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Cropped the search modal gift card artwork slightly more to remove the grey edge around the card.
- files: components/gift-card-tile.module.css, components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Restyled the search modal gift card to match the home and shop card treatment by removing the inner frame and using a direct cropped tile.
- files: components/search-modal-trigger.tsx, components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Reduced the gift card shadow intensity in the search modal without changing the home or shop card shadows.
- files: components/gift-card-tile.module.css, components/search-modal-trigger.module.css, HISTORY.md
- status: completed


## 2026-03-18
- [done] Unified nav and floating basket triggers into one cart drawer instance so both buttons open the same drawer.
- files: components/basket-link.tsx, components/site-header.tsx, HISTORY.md
- status: completed


## 2026-03-18
- [done] Forced the Continue to Checkout button text color to white across normal/hover/visited states.
- files: components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-18
- [done] Added an admin delivery-cost section backed by D1 and wired checkout to use the saved fee.
- files: app/admin/page.tsx, app/admin/actions.ts, app/admin/page.module.css, app/checkout/page.tsx, components/checkout-client.tsx, lib/stripe-checkout.ts, lib/store-settings.ts, HISTORY.md
- status: completed

## 2026-03-19
- [done] Enabled Apple Pay and Google Pay express checkout before the secure-payment button by adding a Stripe confirmation-token express flow on checkout.
- files: components/checkout-client.tsx, app/api/stripe/express-payment/route.ts, HISTORY.md
- status: completed

## 2026-03-20
- [done] Enabled PayPal in Stripe express checkout and updated the express-payment route to confirm PayPal payment intents.
- files: components/checkout-client.tsx, app/api/stripe/express-payment/route.ts, HISTORY.md
- status: completed

## 2026-03-20
- [done] Removed the manual secure-payment step by auto-initializing the Stripe PaymentIntent once required checkout details are filled, so express wallets can appear without clicking the button.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-20
- [done] Enlarged and stacked express checkout buttons so Apple Pay, Google Pay, and PayPal render as full-width rows when Stripe makes them available.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-20
- [done] Fixed Stripe express checkout runtime validation by reducing the configured wallet button height to the supported maximum.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-20
- [done] Restored the manual checkout trigger so payment options load after clicking the secure-payment button again.
- files: components/checkout-client.tsx, HISTORY.md
- status: completed

## 2026-03-21
- [done] Restored the outer search-result card shell for gift cards so they render inside the same boxed card layout as other search items.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed
- [done] Added a divider line between the gift card image area and text in the search modal result card.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed
- [done] Matched the search modal gift card sizing to the standard result card measurements while keeping the image-text divider.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed
- [done] Moved the search modal gift card divider onto the image container so the image-text split aligns with other result cards.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed
- [done] Restored the search modal gift card tile to its original smaller inner size while keeping the aligned divider.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed
- [done] Matched the search modal gift card image container sizing behavior to the standard result cards so the divider aligns correctly.
- files: components/search-modal-trigger.module.css, HISTORY.md
- status: completed

## 2026-03-21
- [done] Removed the Availability and Price filter buttons from the shop page toolbar.
- files: app/shop/page.tsx, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-21
- [done] Removed the grid and list view toggle buttons from the shop page toolbar.
- files: app/shop/page.tsx, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-21
- [done] Added matching inline underline links to the home page shop intro copy.
- files: app/page.tsx, app/page.module.css, HISTORY.md
- status: completed

## 2026-03-21
- [done] Moved the shop toolbar sort control to the right side of the items row.
- files: app/shop/page.tsx, app/shop/page.module.css, HISTORY.md
- status: completed

## 2026-03-25
- [done] Expanded the account page into a full Supabase customer auth flow with registration, sign-in, signed-in state, and sign-out.
- files: app/account/page.tsx, components/account-signup-form.tsx, components/account-signup-form.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Updated the site header account control to show a signed-in customer badge and account label when Supabase auth is active.
- files: components/header-account-link.tsx, components/site-header.tsx, components/site-header.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Reworked the signed-in header control into an avatar dropdown with settings, order history, and logout actions, and added matching account-page anchor sections.
- files: components/header-account-link.tsx, components/site-header.module.css, app/account/page.tsx, app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Converted the account route into an auth-aware settings dashboard with sidebar navigation and D1-backed order history matched by customer email.
- files: app/account/page.tsx, app/account/page.module.css, components/account-page-client.tsx, app/api/account/orders/route.ts, lib/account-orders.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Removed the account settings and order history cards from the account page and simplified the signed-in header menu link.
- files: app/account/page.tsx, app/account/page.module.css, components/header-account-link.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Matched the header account dropdown Account link size to the Log out action.
- files: components/site-header.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Rewrote the repository README as a GitHub-facing showcase and added a real homepage screenshot asset.
- files: README.md, docs/screenshots/homepage.png, HISTORY.md
- status: completed

## 2026-03-26
- [done] Pinned the signed-in account sidebar so the account card and section nav stay fixed on screen instead of scrolling with the page.
- files: app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Adjusted the fixed account sidebar offset so it stays pinned at its original visual starting position on the page.
- files: app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved the fixed account sidebar lower on the page so its pinned position sits closer to the main account content.
- files: app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Lowered the fixed account sidebar again to better match the requested pinned position.
- files: app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Reduced the account dashboard bottom padding so the page stops closer to the end of the order section.
- files: app/account/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Hid the global site footer on the account page so scrolling stops at the account content instead of revealing the purple footer block.
- files: app/account/page.tsx, app/globals.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Separated customer and admin access by requiring an explicit Supabase admin email allowlist for `/admin` sessions and logins.
- files: lib/supabase/admin-auth.ts, app/admin/actions.ts, app/admin/page.tsx, .env.example, README.md, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved `/admin` authorization from the local email allowlist to Supabase user app metadata claims.
- files: lib/supabase/admin-auth.ts, app/admin/page.tsx, .env.example, README.md, HISTORY.md
- status: completed

## 2026-03-26
- [done] Shortened the admin login denial copy to "Access denied."
- files: lib/supabase/admin-auth.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Added admin controls for Cookie of the Month section copy and moved Cookie of the Month product selection into a tick box on the products table.
- files: app/admin/actions.ts, app/admin/page.tsx, app/admin/page.module.css, app/page.tsx, components/admin-cookie-of-month-toggle.tsx, lib/store-settings.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Added admin controls for the homepage Our shop section and wired the homepage intro copy to editable D1-backed settings.
- files: app/admin/actions.ts, app/admin/page.tsx, app/page.tsx, lib/store-settings.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Changed the admin Cookie of the Month table toggle to use an explicit Save button so checked state stays visible before submission.
- files: components/admin-cookie-of-month-toggle.tsx, app/admin/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Restricted the admin Cookie of the Month table UI to one selected product at a time before save.
- files: components/admin-cookie-of-month-toggle.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Removed the admin Cookie of the Month save button and restored auto-save while keeping single-product selection behavior.
- files: components/admin-cookie-of-month-toggle.tsx, app/admin/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Fixed admin Cookie of the Month auto-save to submit an explicit selected state so the new choice persists instead of snapping back.
- files: components/admin-cookie-of-month-toggle.tsx, app/admin/actions.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Fixed delivery-cost updates staying stale by disabling cached D1 reads for store settings and revalidating checkout/admin after save.
- files: lib/store-settings.ts, app/admin/actions.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Fixed the admin Cookie of the Month table toggle to submit the current selected value reliably during auto-save.
- files: components/admin-cookie-of-month-toggle.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Replaced the admin Cookie of the Month table toggle with a server-rendered action button to avoid the admin table hydration mismatch.
- files: app/admin/page.tsx, app/admin/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Changed the homepage Cookie of the Month CTA to default to the selected cookie product page and fall back to the Double Chocolate Hazelnut product instead of `/shop`.
- files: app/page.tsx, lib/store-settings.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Added admin controls for the homepage brand story statement and wired the closing homepage copy to editable D1-backed settings.
- files: app/admin/actions.ts, app/admin/page.tsx, app/page.tsx, lib/store-settings.ts, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved admin delivery-cost controls onto a separate `/admin/delivery` page and added a matching sidebar tab.
- files: app/admin/actions.ts, app/admin/page.tsx, app/admin/delivery/page.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved the admin featured-products link into the Products sidebar section.
- files: app/admin/page.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Matched the delivery admin sidebar to the same three-link layout used on the main admin page.
- files: app/admin/delivery/page.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Flattened the admin sidebar so it shows only the three main section tabs without extra grouped cards.
- files: app/admin/page.module.css, app/admin/page.tsx, app/admin/delivery/page.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved homepage admin content controls into a dedicated Home page tab and route.
- files: app/admin/actions.ts, app/admin/page.tsx, app/admin/delivery/page.tsx, app/admin/homepage/page.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Restored the Cookie of the Month setting lookup on the products admin page so the product-table selector can render after moving homepage panels out.
- files: app/admin/page.tsx, HISTORY.md
- status: completed

## 2026-03-26
- [done] Made the admin dashboard metric cards link to the matching products, featured products, and delivery pages.
- files: app/admin/page.tsx, app/admin/page.module.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Increased the footer Instagram and TikTok icon size and shifted the mobile social group left for better visibility.
- files: app/globals.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved the mobile footer social icons farther left so the floating basket button no longer overlaps them.
- files: app/globals.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Shifted the mobile footer social icons further left to improve clearance from the floating basket button.
- files: app/globals.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Reworked the mobile footer bottom row into a left-aligned stacked layout so the social icons visibly sit farther left and clear the floating basket button.
- files: app/globals.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Moved the desktop footer social icons inward by changing the bottom-row grid so they no longer sit on the far right edge.
- files: app/globals.css, HISTORY.md
- status: completed

## 2026-03-26
- [done] Restored the desktop footer grid so the terms link stays centered and shifted only the social icons left with a dedicated offset.
- files: app/globals.css, HISTORY.md
- status: completed

## 2026-03-27
- [done] Added Wrangler-managed D1 customer profiles, saved addresses, and Supabase-linked account order ownership with authenticated account APIs and UI persistence.
- files: wrangler.toml, cloudflare/d1/migrations/0001_customer_profiles.sql, cloudflare/d1/schema.sql, lib/account-auth.ts, lib/customer-profiles.ts, lib/account-orders.ts, lib/stripe-checkout.ts, app/api/account/profile/route.ts, app/api/account/addresses/route.ts, app/api/account/orders/route.ts, app/api/stripe/payment-intent/route.ts, app/api/stripe/express-payment/route.ts, components/checkout-client.tsx, components/account-page-client.tsx, app/account/page.module.css, package.json, package-lock.json, README.md, cloudflare-upload.md, HISTORY.md
- status: completed

## 2026-03-27
- [done] Upgraded vulnerable runtime dependencies, replaced the broken forced-audit lint stack with a clean modern ESLint setup, and cleared npm audit findings.
- files: package.json, package-lock.json, eslint.config.mjs, HISTORY.md
- status: completed

## 2026-03-27
- [done] Made basket and checkout pricing server-authoritative with quote-backed cart/checkout totals, structured tip handling, stale payment-session resets, `/terms` redirect coverage, and Supabase auth/RLS documentation notes.
- files: README.md, app/api/basket/quote/route.ts, app/api/stripe/express-payment/route.ts, app/api/stripe/payment-intent/route.ts, app/checkout/page.tsx, app/layout.tsx, app/shop/[slug]/page.tsx, app/terms/page.tsx, components/cart-client.tsx, components/checkout-client.tsx, components/product-basket-controls.tsx, components/quick-add-button.tsx, lib/basket-storage.ts, lib/basket.ts, lib/checkout-quote.ts, lib/stripe-checkout.ts, HISTORY.md
- status: completed

## 2026-03-27
- [done] Fixed the cart hydration state so direct `/cart` loads no longer flash a misleading `GBP 0.00` subtotal before the basket quote resolves.
- files: components/cart-client.tsx, components/cart-client.module.css, HISTORY.md
- status: completed

## 2026-03-27
- [done] Reduced admin route load latency by parallelizing settings reads, deriving next product positions locally, and memoizing schema setup queries for admin/store settings.
- files: app/admin/page.tsx, app/admin/homepage/page.tsx, lib/product-admin.ts, lib/store-settings.ts, lib/supabase/admin-auth.ts, HISTORY.md
- status: completed

## 2026-03-27
- [done] Hardened admin sign-in with cooldown-based throttling, shared login warnings, and CSP/clickjacking headers.
- files: .env.example, README.md, app/admin/actions.ts, app/admin/delivery/page.tsx, app/admin/homepage/page.tsx, app/admin/page.tsx, cloudflare/d1/migrations/0002_admin_login_attempts.sql, cloudflare/d1/schema.sql, components/admin-login-screen.tsx, lib/admin-login-throttle.ts, lib/supabase/admin-auth.ts, next.config.ts, HISTORY.md
- status: completed

## 2026-03-27
- [done] Ignored local runtime artifacts and removed tracked dev logs, local state, and local database files from version control.
- files: .gitignore, .playwright-cli, .wrangler, .next-dev.out.log, .next-dev.err.log, Products.db, HISTORY.md
- status: completed

## 2026-03-27
- [done] Rewrote git history and force-pushed all branches to purge committed local runtime artifacts from the public repository.
- files: HISTORY.md, .playwright-cli, .wrangler, .next-dev.out.log, .next-dev.err.log, Products.db
- status: completed

## 2026-03-30
- [done] Replaced the manual Stripe payment gate with an always-open deferred Elements checkout and unified server-side payment confirmation.
- files: components/checkout-client.tsx, app/api/stripe/confirm-payment/route.ts, app/api/stripe/payment-intent/route.ts, app/api/stripe/express-payment/route.ts, README.md, HISTORY.md
- status: completed

## 2026-03-30
- [done] Reduced checkout submit latency by overlapping auth/token work and batching D1 order creation writes in the deferred Stripe confirmation flow.
- files: app/api/stripe/confirm-payment/route.ts, lib/stripe-checkout.ts, HISTORY.md
- status: completed

## 2026-04-04
- [done] Replaced the checkout confirmation hard timeout with a soft in-progress notice so slow Stripe confirmations keep running instead of surfacing a false failure after 25 seconds.
- files: HISTORY.md, components/checkout-client.tsx
- status: completed

## 2026-04-05
- [done] Reduced checkout confirmation latency by caching the D1 binding, parallelizing quote dependencies, and batching checkout-attempt writes instead of issuing multiple D1 calls per payment submit.
- files: HISTORY.md, lib/cloudflare-d1.ts, lib/checkout-quote.ts, lib/checkout-attempt-throttle.ts
- status: completed

## 2026-04-05
- [done] Refactored checkout payment confirmation with correlated client/server timing logs, safer Payment Element selection handling, and express wallet readiness state so stalls are diagnosable and express buttons can initialize without a display-none wrapper.
- files: HISTORY.md, components/checkout-client.tsx, components/checkout-client.module.css, app/api/stripe/confirm-payment/route.ts
- status: completed
