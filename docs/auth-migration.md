# Supabase Auth to Better Auth cutover

This migration keeps each Supabase user ID unchanged, so existing D1 customer profiles and orders remain linked to the same person. Existing Supabase bcrypt password hashes are imported and accepted by the Better Auth compatibility verifier. Sessions are intentionally not copied, so everyone signs in once after cutover.

The only admin account is `orders@growncookies.co.uk`. The import tool assigns `admin` to that exact normalized email and `customer` to every other account. Deleted accounts and accounts with a current ban are excluded; their historical orders remain in D1.

## 1. Prepare services

1. Generate a long random `BETTER_AUTH_SECRET` and keep the same value for the lifetime of the production deployment.
2. Set `BETTER_AUTH_URL=https://growncookies.co.uk` and `NEXT_PUBLIC_SITE_URL=https://growncookies.co.uk` in production.
3. Keep the existing Zoho OAuth values. Verification and password-reset mail is sent from `orders@growncookies.co.uk`.

Google sign-in is currently disabled. The import still preserves any existing Google identity rows so they can be re-enabled later without creating a second customer account.

## 2. Back up before cutover

Keep Supabase active until the final export is complete.

1. Create a D1 backup before applying migration `0021_better_auth.sql`:

```bash
npx wrangler d1 export grown-cookies --remote --output migration-private/d1-before-better-auth.sql
```

2. In the Supabase SQL editor, run the query below and download its results as CSV. Save it as `migration-private/supabase-auth-users.csv`. This directory is ignored by Git because the export contains password hashes.

```sql
select
  u.id::text as id,
  u.email,
  u.encrypted_password,
  u.email_confirmed_at,
  u.confirmed_at,
  u.created_at,
  u.updated_at,
  u.banned_until,
  u.deleted_at,
  u.raw_user_meta_data,
  u.raw_app_meta_data,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id::text,
          'provider_id', i.provider_id,
          'provider', i.provider,
          'identity_data', i.identity_data,
          'created_at', i.created_at,
          'updated_at', i.updated_at
        )
        order by i.created_at
      )
      from auth.identities i
      where i.user_id = u.id
    ),
    '[]'::jsonb
  ) as identities
from auth.users u
order by u.created_at;
```

Record the Supabase totals for comparison:

```sql
select
  count(*) filter (where deleted_at is null and (banned_until is null or banned_until <= now())) as eligible_users,
  count(*) filter (
    where deleted_at is null
      and (banned_until is null or banned_until <= now())
      and encrypted_password is not null
      and encrypted_password <> ''
  ) as eligible_password_users,
  (
    select count(*)
    from auth.identities i
    join auth.users identity_user on identity_user.id = i.user_id
    where i.provider = 'google'
      and identity_user.deleted_at is null
      and (identity_user.banned_until is null or identity_user.banned_until <= now())
  ) as eligible_google_identities
from auth.users;
```

## 3. Prepare and test the import

Generate private D1 import SQL:

```bash
npm run auth:prepare-import
```

The command prints imported and skipped counts and writes `migration-private/better-auth-import.sql`. Review those counts before applying it.

Apply all migrations and the import to a local D1 database first:

```bash
npx wrangler d1 migrations apply grown-cookies --local
npx wrangler d1 execute grown-cookies --local --file migration-private/better-auth-import.sql
```

Validate that:

- the user total equals the eligible Supabase total;
- credential totals match the export, and any historical Google identity count is preserved for later;
- exactly one admin exists and its email is `orders@growncookies.co.uk`;
- no unexpected admin exists;
- a migrated password works;
- account order history still appears.

## 4. Production cutover

Use a short maintenance window so no account is created between the final export and import.

1. Take the final Supabase export and a fresh D1 backup.
2. Regenerate `migration-private/better-auth-import.sql` from the final export.
3. Apply D1 migration `0021_better_auth.sql` remotely:

   ```bash
   npm run cloudflare:d1:migrate
   ```

4. Apply the private import SQL remotely:

   ```bash
   npx wrangler d1 execute grown-cookies --remote --file migration-private/better-auth-import.sql
   ```
5. Upload the Better Auth and Zoho Worker secrets.
6. Deploy the Worker and run the same count and sign-in checks.
7. Keep the Supabase project untouched until the production checks pass. Then remove its old environment values and retire the project.
8. Securely delete the local export and generated import SQL when the rollback window closes.

The migration renames `orders.supabase_user_id` and `customer_profiles.supabase_user_id` to `auth_user_id`. It does not rewrite their values, which is why preserving the Supabase user IDs in the Better Auth `user` table is required.
