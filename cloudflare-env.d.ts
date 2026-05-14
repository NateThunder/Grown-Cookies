declare global {
  interface D1ResultMeta {
    changes?: number | string;
    duration?: number;
    last_row_id?: number | string;
    rows_read?: number;
    rows_written?: number;
    size_after?: number;
  }

  interface D1Result<Row = Record<string, unknown>> {
    success: boolean;
    results?: Row[];
    meta: D1ResultMeta;
  }

  interface D1PreparedStatement {
    bind(...values: Array<string | number | null>): D1PreparedStatement;
    all<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
    run<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface CloudflareEnv {
    DB?: D1Database;
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
  }
}

export {};
