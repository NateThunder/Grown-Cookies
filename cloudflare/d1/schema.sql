CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  description TEXT NOT NULL,
  seo_description TEXT,
  allergens TEXT NOT NULL DEFAULT '',
  is_gift_card INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  related_slugs TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS featured_products (
  product_slug TEXT NOT NULL PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_slug) REFERENCES products(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  delivered_at TEXT,
  paid_at TEXT,
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  gift_card_redeemed_cents INTEGER NOT NULL DEFAULT 0,
  stripe_amount_cents INTEGER,
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT,
  fulfilment_method TEXT,
  dispatch_date TEXT,
  collection_venue TEXT,
  collection_address_line1 TEXT,
  collection_city TEXT,
  collection_postcode TEXT,
  collection_window_start TEXT,
  collection_window_end TEXT,
  collected_at TEXT,
  collected_customer_email_sent_at TEXT,
  supabase_user_id TEXT,
  customer_profile_id INTEGER,
  stripe_payment_intent_id TEXT,
  paid_notification_sent_at TEXT,
  paid_customer_email_sent_at TEXT,
  order_journey_json TEXT,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL,
  gifting_card_id TEXT,
  gifting_card_label TEXT,
  gifting_card_price_cents INTEGER,
  gifting_message TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_event_id TEXT NOT NULL UNIQUE,
  order_public_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supabase_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  stripe_customer_id TEXT,
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

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_key TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_image_variants (
  product_id INTEGER NOT NULL,
  variant TEXT NOT NULL,
  image_key TEXT NOT NULL,
  alt_text TEXT,
  crop_pan_x REAL NOT NULL DEFAULT 0,
  crop_pan_y REAL NOT NULL DEFAULT 0,
  crop_zoom REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, variant),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkout_payment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  initial_amount_pence INTEGER NOT NULL CHECK (initial_amount_pence > 0),
  balance_pence INTEGER NOT NULL CHECK (
    balance_pence >= 0
    AND balance_pence <= initial_amount_pence
  ),
  order_item_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS mailing_list_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'footer',
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_slug
  ON products(slug);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_primary
  ON product_images(product_id, is_primary, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_product_image_variants_product_id
  ON product_image_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_scope_identifier_time
  ON admin_login_attempts(scope, identifier_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_attempted_at
  ON admin_login_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_scope_identifier_time
  ON checkout_payment_attempts(scope, identifier_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_attempted_at
  ON checkout_payment_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_orders_public_id
  ON orders(public_id);

CREATE INDEX IF NOT EXISTS idx_orders_payment_intent
  ON orders(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_orders_supabase_user_id
  ON orders(supabase_user_id);

CREATE INDEX IF NOT EXISTS idx_orders_email
  ON orders(email);

CREATE INDEX IF NOT EXISTS idx_orders_dispatch_date
  ON orders(dispatch_date);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_webhook_events_event_id
  ON order_webhook_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_featured_products_position
  ON featured_products(position);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_email
  ON customer_profiles(email);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_profile_id
  ON customer_addresses(customer_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_default_profile
  ON customer_addresses(customer_profile_id)
  WHERE is_default = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_order_item
  ON gift_cards(order_item_id)
  WHERE order_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_card_redemptions_order_card
  ON gift_card_redemptions(order_id, gift_card_id);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order
  ON gift_card_redemptions(order_id);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order_public
  ON gift_card_redemptions(order_public_id);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_status
  ON gift_card_redemptions(status);

CREATE INDEX IF NOT EXISTS idx_mailing_list_subscribers_status
  ON mailing_list_subscribers(status);

CREATE INDEX IF NOT EXISTS idx_mailing_list_subscribers_subscribed_at
  ON mailing_list_subscribers(subscribed_at);
