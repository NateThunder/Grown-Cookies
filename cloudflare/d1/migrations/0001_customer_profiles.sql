CREATE TABLE IF NOT EXISTS customer_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supabase_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_profile_id INTEGER NOT NULL,
  label TEXT,
  first_name TEXT,
  last_name TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE CASCADE
);

ALTER TABLE orders ADD COLUMN supabase_user_id TEXT;
ALTER TABLE orders ADD COLUMN customer_profile_id INTEGER REFERENCES customer_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_email
  ON customer_profiles(email);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_profile_id
  ON customer_addresses(customer_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_default_profile
  ON customer_addresses(customer_profile_id)
  WHERE is_default = 1;

CREATE INDEX IF NOT EXISTS idx_orders_supabase_user_id
  ON orders(supabase_user_id);

CREATE INDEX IF NOT EXISTS idx_orders_email
  ON orders(email);
