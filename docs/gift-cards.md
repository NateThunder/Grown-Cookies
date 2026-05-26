# Gift Card Generation

Apply the D1 migration before using the endpoint:

```bash
npm run cloudflare:d1:migrate
```

Gift card redemption is handled in checkout. Customers can apply one or more gift card codes on the checkout page. Codes reduce eligible physical-cookie items plus delivery only; gift cards do not pay for tips or other gift card products. If the applied balance covers the full eligible order, checkout places the order without Stripe card details.

Use `cloudflare-upload.md` for the repo's Cloudflare deployment and runtime-secret split. Gift card storage uses the Worker `DB` binding; no Cloudflare deploy token should be present in runtime secrets.

Create a gift card from an authenticated admin session:

```bash
curl -X POST https://growncookies.co.uk/api/admin/gift-cards \
  -H "Content-Type: application/json" \
  -H "Cookie: gc_admin_access_token=<admin-access-token>" \
  -d "{\"initialAmountPence\":2500}"
```

The response includes the stored gift card record:

```json
{
  "giftCard": {
    "id": 1,
    "code": "GC-ABCD-EFGH-JKLM",
    "initialAmountPence": 2500,
    "balancePence": 2500,
    "createdAt": "2026-04-14 12:00:00"
  }
}
```

Redemptions are stored in `gift_card_redemptions` as `reserved`, `finalized`, `released`, or `restored`. Pending reservations follow the existing checkout pending-order expiry window.
