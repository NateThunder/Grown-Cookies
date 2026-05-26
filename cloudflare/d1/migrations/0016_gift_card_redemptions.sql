ALTER TABLE orders ADD COLUMN gift_card_redeemed_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN stripe_amount_cents INTEGER;

UPDATE orders
SET stripe_amount_cents = total_cents
WHERE stripe_amount_cents IS NULL;

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_card_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  order_public_id TEXT NOT NULL,
  code TEXT NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'finalized', 'released', 'restored')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at TEXT,
  released_at TEXT,
  restored_at TEXT,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_card_redemptions_order_card
  ON gift_card_redemptions(order_id, gift_card_id);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order
  ON gift_card_redemptions(order_id);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order_public
  ON gift_card_redemptions(order_public_id);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_status
  ON gift_card_redemptions(status);
