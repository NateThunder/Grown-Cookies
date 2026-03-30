CREATE TABLE IF NOT EXISTS checkout_payment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_scope_identifier_time
  ON checkout_payment_attempts(scope, identifier_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_attempted_at
  ON checkout_payment_attempts(attempted_at);
