INSERT OR REPLACE INTO products (
  slug,
  name,
  price,
  description,
  allergens,
  is_gift_card,
  featured,
  sort_order,
  related_slugs
) VALUES
  (
    'dark-choc-maldon-salt',
    'Dark Chocolate Maldon Salt',
    'GBP 23.00',
    'Indulge in the rich decadence of our Dark Choc & Maldon Salt Cookie. Bursting with delicious 70% dark chocolate and a touch of milk chocolate, this elevated treat is finished with Maldon salt for a deep, balanced bite.',
    'wheat, milk, eggs',
    0,
    1,
    10,
    '["double-chocolate-hazelnut","matcha-white-chocolate","red-velvet","granola-raisin"]'
  ),
  (
    'double-chocolate-hazelnut',
    'Double Chocolate & Hazelnut',
    'GBP 23.00',
    'Our Chocolate & Hazelnut Cookie is packed with milk and dark chocolate chips, plus roasted hazelnuts for a cookie that lands rich, smooth, and crunchy in every bite.',
    'wheat, milk, eggs, hazelnuts',
    0,
    1,
    20,
    '[]'
  ),
  (
    'gift-card',
    'Gift Card',
    'GBP 10.00',
    'Send a Grown Cookies gift card and let them choose their own flavour favourites. Perfect for birthdays, celebrations, and thoughtful surprises.',
    '',
    1,
    1,
    30,
    '[]'
  ),
  (
    'granola-raisin',
    'Crunchy Granola & Raisin',
    'GBP 22.00',
    'A hearty oat cookie loaded with toasted granola clusters, juicy raisins, cranberries, and seeds for a warm, nostalgic bite with plenty of texture.',
    'wheat, milk, eggs, almond',
    0,
    0,
    40,
    '[]'
  ),
  (
    'matcha-white-chocolate',
    'Matcha White Chocolate',
    'GBP 23.00',
    'Ceremonial-grade matcha brings earthy depth while creamy white chocolate keeps every bite smooth, sweet, and vibrant.',
    'wheat, milk, eggs',
    0,
    0,
    50,
    '[]'
  ),
  (
    'red-velvet',
    'Red Velvet',
    'GBP 22.00',
    'A rich red velvet cookie with real cocoa and creamy white chocolate chunks, baked for a bold dessert-style finish.',
    'wheat, milk, eggs',
    0,
    0,
    60,
    '[]'
  ),
  (
    'double-choc-box',
    'Variety Box',
    'GBP 24.00',
    'Try the full range in one box. This six-cookie selection includes matcha white chocolate, crunchy granola and raisin, dark chocolate Maldon salt, red velvet, double chocolate hazelnut, and the cookie of the month.',
    'wheat, milk, eggs, almond, hazelnuts, soya',
    0,
    0,
    70,
    '[]'
  );
INSERT OR REPLACE INTO featured_products (
  product_slug,
  position
) VALUES
  ('dark-choc-maldon-salt', 1),
  ('double-chocolate-hazelnut', 2),
  ('gift-card', 3);
INSERT OR REPLACE INTO product_images (
  product_id,
  image_key,
  alt_text,
  sort_order,
  is_primary
)
SELECT p.id, seeded.image_key, seeded.alt_text, seeded.sort_order, seeded.is_primary
FROM (
  SELECT 'dark-choc-maldon-salt' AS slug, 'Dark_Choc-_Salt/_DSC6327.jpg' AS image_key, 'Dark Chocolate Maldon Salt cookie' AS alt_text, 0 AS sort_order, 1 AS is_primary
  UNION ALL
  SELECT 'double-chocolate-hazelnut', 'Double_Choc_Hazelnut/_DSC6200.jpg', 'Double Chocolate and Hazelnut cookie', 0, 1
  UNION ALL
  SELECT 'gift-card', 'gift-card/growncookies-1024-transparent.png', 'Grown Cookies gift card', 0, 1
  UNION ALL
  SELECT 'granola-raisin', 'Crunchy_Granola/_DSC6127.jpg', 'Crunchy Granola and Raisin cookie', 0, 1
  UNION ALL
  SELECT 'matcha-white-chocolate', 'Matcha/_DSC6441.jpg', 'Matcha White Chocolate cookie', 0, 1
  UNION ALL
  SELECT 'red-velvet', 'Red_Velvet/_DSC6161.jpg', 'Red Velvet cookie', 0, 1
  UNION ALL
  SELECT 'double-choc-box', 'Box_Shots/_DSC6145.jpg', 'Variety box of cookies', 0, 1
) AS seeded
JOIN products p ON p.slug = seeded.slug;