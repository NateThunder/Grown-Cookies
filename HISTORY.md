# Project History

This file tracks work completed in the repository for easy machine-readable review.

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
