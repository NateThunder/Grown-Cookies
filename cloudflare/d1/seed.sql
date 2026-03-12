INSERT OR REPLACE INTO products (
  slug,
  name,
  price,
  description,
  image_url,
  is_gift_card,
  featured,
  sort_order,
  related_slugs
) VALUES
  (
    'dark-choc-maldon-salt',
    'Dark Choc & Maldon Salt',
    '£22.00',
    'Indulge in the rich decadence of our Dark Choc & Maldon Salt Cookie. Bursting with delicious 70% dark chocolate, this elevated treat is further enhanced by the addition of Maldon salt, adding a unique and luxurious flavour to each bite.',
    '/Dark_Choc-_Salt/_DSC6327.jpg',
    0,
    1,
    10,
    '["double-chocolate-hazelnut","matcha-white-chocolate","red-velvet","granola-raisin"]'
  ),
  (
    'double-chocolate-hazelnut',
    'Double Chocolate & Hazelnut',
    '£22.00',
    'Our Double Chocolate & Hazelnut cookie is packed with deep cocoa notes, crunchy roasted hazelnuts, and a soft center that stays rich in every bite.',
    '/Double_Choc_Hazelnut/_DSC6200.jpg',
    0,
    1,
    20,
    '[]'
  ),
  (
    'gift-card',
    'Gift Card',
    '£10.00',
    'Send a Grown Cookies gift card and let them choose their own flavour favourites. Perfect for birthdays, celebrations, and thoughtful surprises.',
    NULL,
    1,
    1,
    30,
    '[]'
  ),
  (
    'granola-raisin',
    'Granola Raisin',
    '£22.00',
    'A comforting oat-forward cookie with toasted granola clusters and juicy raisins for a warm, nostalgic bite.',
    '/Crunchy_Granola/_DSC6127.jpg',
    0,
    0,
    40,
    '[]'
  ),
  (
    'matcha-white-chocolate',
    'Matcha White Chocolate',
    '£22.00',
    'Earthy matcha and creamy white chocolate come together for a balanced cookie with vibrant colour and smooth sweetness.',
    '/Matcha/_DSC6441.jpg',
    0,
    0,
    50,
    '[]'
  ),
  (
    'red-velvet',
    'Red Velvet',
    '£22.00',
    'Our Red Velvet cookie blends cocoa richness with a velvety texture and a subtle tang for a bold dessert-style treat.',
    '/Red_Velvet/_DSC6161.jpg',
    0,
    0,
    60,
    '[]'
  ),
  (
    'double-choc-box',
    'Double Choc Box',
    '£22.00',
    'A curated cookie box featuring crowd-favourite chocolate flavours, baked fresh and ready to share.',
    '/Box_Shots/_DSC6145.jpg',
    0,
    0,
    70,
    '[]'
  );
