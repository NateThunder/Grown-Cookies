CREATE TABLE IF NOT EXISTS contact_form_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_form_attempts_scope_identifier_time
  ON contact_form_attempts(scope, identifier_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_contact_form_attempts_attempted_at
  ON contact_form_attempts(attempted_at);
