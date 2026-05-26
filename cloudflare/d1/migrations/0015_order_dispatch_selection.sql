ALTER TABLE orders ADD COLUMN fulfilment_method TEXT;
ALTER TABLE orders ADD COLUMN dispatch_date TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_dispatch_date
  ON orders(dispatch_date);
