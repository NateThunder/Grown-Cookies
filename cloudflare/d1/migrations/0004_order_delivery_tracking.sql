ALTER TABLE orders ADD COLUMN delivered_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_at
  ON orders(delivered_at);
