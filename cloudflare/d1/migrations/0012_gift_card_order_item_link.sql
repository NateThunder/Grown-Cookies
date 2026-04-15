ALTER TABLE gift_cards ADD COLUMN order_item_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_order_item
  ON gift_cards(order_item_id)
  WHERE order_item_id IS NOT NULL;
