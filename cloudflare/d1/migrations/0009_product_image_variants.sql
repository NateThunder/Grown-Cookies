CREATE TABLE IF NOT EXISTS product_image_variants (
  product_id INTEGER NOT NULL,
  variant TEXT NOT NULL,
  image_key TEXT NOT NULL,
  alt_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, variant),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_image_variants_product_id
  ON product_image_variants(product_id);
