INSERT INTO orders (
  public_id, status, delivered_at, currency, subtotal_cents, shipping_cents, tip_cents, total_cents,
  email, phone, first_name, last_name, address_line1, address_line2, city, postcode, country,
  stripe_payment_intent_id, items_json, paid_notification_sent_at, paid_customer_email_sent_at
) VALUES (
  'order_test_1775513046_8695', 'paid', NULL, 'gbp', 2200, 450, 0, 2650,
  'stoneyexperiment@gmail.com', '07000000000', 'Test', 'Customer', '1 Test Street', '', 'London', 'SW1A 1AA', 'United Kingdom',
  'pi_test_order_test_1775513046_8695', '{"lines":[{"slug":"granola-raisin","name":"Crunchy Granola & Raisin","image":"","imageAlt":"Crunchy Granola & Raisin","isGiftCard":false,"unitPriceCents":2200,"quantity":1,"lineTotalCents":2200}],"subtotalCents":2200,"shippingCents":450,"tipCents":0,"totalCents":2650,"tipCurrency":"gbp","contact":{"email":"stoneyexperiment@gmail.com","phone":"07000000000"},"delivery":{"firstName":"Test","lastName":"Customer","address":"1 Test Street","flatNumber":"","city":"London","postcode":"SW1A 1AA","country":"United Kingdom"}}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
INSERT INTO order_items (order_id, product_slug, product_name, unit_price_cents, quantity, line_total_cents)
SELECT id, 'granola-raisin', 'Crunchy Granola & Raisin', 2200, 1, 2200
FROM orders
WHERE public_id = 'order_test_1775513046_8695';
SELECT public_id, status, email, total_cents, created_at
FROM orders
WHERE public_id = 'order_test_1775513046_8695';