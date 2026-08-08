ALTER TABLE orders ADD COLUMN collection_venue TEXT;
ALTER TABLE orders ADD COLUMN collection_address_line1 TEXT;
ALTER TABLE orders ADD COLUMN collection_city TEXT;
ALTER TABLE orders ADD COLUMN collection_postcode TEXT;
ALTER TABLE orders ADD COLUMN collection_window_start TEXT;
ALTER TABLE orders ADD COLUMN collection_window_end TEXT;
ALTER TABLE orders ADD COLUMN collected_at TEXT;
ALTER TABLE orders ADD COLUMN collected_customer_email_sent_at TEXT;
