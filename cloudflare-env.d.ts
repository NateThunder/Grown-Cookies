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
  }
}

export {};
