ALTER TABLE product_image_variants
  ADD COLUMN crop_pan_x REAL NOT NULL DEFAULT 0;

ALTER TABLE product_image_variants
  ADD COLUMN crop_pan_y REAL NOT NULL DEFAULT 0;

ALTER TABLE product_image_variants
  ADD COLUMN crop_zoom REAL NOT NULL DEFAULT 1;
