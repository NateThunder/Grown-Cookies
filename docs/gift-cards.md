# Gift Card Generation

Apply the D1 migration before using the endpoint:

```bash
npm run cloudflare:d1:migrate
```

Use `cloudflare-upload.md` for the repo's Cloudflare token requirements.

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
