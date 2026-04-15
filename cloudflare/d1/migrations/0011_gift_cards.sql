CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  initial_amount_pence INTEGER NOT NULL CHECK (initial_amount_pence > 0),
  balance_pence INTEGER NOT NULL CHECK (
    balance_pence >= 0
    AND balance_pence <= initial_amount_pence
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
