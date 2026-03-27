CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_scope_identifier_time
  ON admin_login_attempts(scope, identifier_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_attempted_at
  ON admin_login_attempts(attempted_at);
