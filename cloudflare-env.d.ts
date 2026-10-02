import type { D1Database as CloudflareD1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB?: CloudflareD1Database;
    CONTACT_FORM_FROM?: string;
    CONTACT_FORM_TO?: string;
    CONTACT_THROTTLE_SECRET?: string;
    ORDER_NOTIFICATION_FROM?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    ZOHO_CLIENT_ID?: string;
    ZOHO_CLIENT_SECRET?: string;
    ZOHO_REFRESH_TOKEN?: string;
    ZOHO_ACCOUNT_ID?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    BETTER_AUTH_TRUSTED_ORIGINS?: string;
  }
}

export {};
