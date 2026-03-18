# Project History

This file tracks work completed in the repository for easy machine-readable review.

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
