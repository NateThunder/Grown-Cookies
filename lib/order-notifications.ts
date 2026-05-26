import { executeCloudflareD1, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { formatDispatchDate, formatDispatchMethod } from "@/lib/dispatch";
import { getGiftCardRedemptionsForOrder, issueGiftCardsForPaidOrder } from "@/lib/gift-cards";
import {
  getZohoOrderNotificationRecipient,
  getZohoOrderNotificationSender,
  isZohoContactEmailConfigured,
  sendZohoEmail,
} from "@/lib/zoho-contact-email";

type OrderNotificationOrderRow = {
  public_id: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  tip_cents: number;
  total_cents: number;
  gift_card_redeemed_cents: number | null;
  stripe_amount_cents: number | null;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  fulfilment_method: string | null;
  dispatch_date: string | null;
  created_at: string;
  delivered_at: string | null;
  paid_notification_sent_at: string | null;
  paid_customer_email_sent_at: string | null;
};

type OrderNotificationItemRow = {
  product_slug: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  is_gift_card: number | null;
  gift_card_code: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isOrderNotificationEmailConfigured() {
  return isZohoContactEmailConfigured();
}

function formatMoney(totalCents: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalCents / 100);
}

function getGiftCardRedeemedCents(order: OrderNotificationOrderRow) {
  return Math.max(0, Number(order.gift_card_redeemed_cents ?? 0));
}

function getStripeAmountCents(order: OrderNotificationOrderRow) {
  const stripeAmount = Number(order.stripe_amount_cents);
  if (Number.isFinite(stripeAmount)) {
    return Math.max(0, stripeAmount);
  }

  return Math.max(0, Number(order.total_cents) - getGiftCardRedeemedCents(order));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAddressLines(order: OrderNotificationOrderRow) {
  return [
    [order.first_name, order.last_name].map(normalizeText).filter(Boolean).join(" "),
    normalizeText(order.address_line1),
    normalizeText(order.address_line2),
    normalizeText(order.city),
    normalizeText(order.postcode),
    normalizeText(order.country),
  ].filter(Boolean);
}

function isGiftCardItem(item: OrderNotificationItemRow) {
  return Boolean(item.is_gift_card) || normalizeText(item.product_slug) === "gift-card";
}

function getOrderDeliveryLabel(
  order: OrderNotificationOrderRow,
  items: OrderNotificationItemRow[],
) {
  const addressLines = buildAddressLines(order);
  const hasOnlyGiftCards = items.length > 0 && items.every(isGiftCardItem);

  if (hasOnlyGiftCards) {
    return {
      heading: "Delivery",
      lines: ["Digital delivery by email"],
    };
  }

  return {
    heading: "Delivery address",
    lines: addressLines.length > 0 ? addressLines : ["Not provided"],
  };
}

function getOrderDispatchLabel(
  order: OrderNotificationOrderRow,
  items: OrderNotificationItemRow[],
) {
  const hasOnlyGiftCards = items.length > 0 && items.every(isGiftCardItem);

  if (hasOnlyGiftCards) {
    return {
      heading: "Dispatch",
      lines: [] as string[],
    };
  }

  return {
    heading: "Dispatch",
    lines: [
      `Method: ${formatDispatchMethod(order.fulfilment_method) || "Not selected"}`,
      `Date: ${formatDispatchDate(normalizeText(order.dispatch_date)) || "Not selected"}`,
    ],
  };
}

function formatOrderItemText(item: OrderNotificationItemRow, currency: string) {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitPrice = formatMoney(item.unit_price_cents, currency);
  const lineTotal = formatMoney(item.line_total_cents, currency);

  if (isGiftCardItem(item)) {
    const giftCardCode = normalizeText(item.gift_card_code);
    return giftCardCode
      ? `${item.product_name} - ${lineTotal} - Gift card code: ${giftCardCode}`
      : `${item.product_name} - ${lineTotal}`;
  }

  return `${quantity} x ${item.product_name} - ${unitPrice} each - ${lineTotal}`;
}

function formatOrderItemHtml(item: OrderNotificationItemRow, currency: string) {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const lineTotal = escapeHtml(formatMoney(item.line_total_cents, currency));

  if (isGiftCardItem(item)) {
    const giftCardCode = normalizeText(item.gift_card_code);
    const codeLine = giftCardCode
      ? `<br /><strong>Gift card code: ${escapeHtml(giftCardCode)}</strong>`
      : "";
    return `<li>${escapeHtml(item.product_name)}<br /><span>Value: ${lineTotal}</span>${codeLine}</li>`;
  }

  const name = escapeHtml(`${quantity} x ${item.product_name}`);
  const unitPrice = escapeHtml(formatMoney(item.unit_price_cents, currency));
  return `<li>${name}<br /><span>Unit price: ${unitPrice}</span><br /><strong>Line total: ${lineTotal}</strong></li>`;
}

function formatOrderDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(parsed);
}

async function getOrderForNotification(orderPublicId: string) {
  const orders = await queryCloudflareD1<OrderNotificationOrderRow>(
    `SELECT
       public_id,
       status,
       currency,
       subtotal_cents,
       shipping_cents,
       tip_cents,
       total_cents,
       gift_card_redeemed_cents,
       stripe_amount_cents,
       email,
       phone,
       first_name,
       last_name,
       address_line1,
       address_line2,
       city,
       postcode,
       country,
       fulfilment_method,
       dispatch_date,
       created_at,
       delivered_at,
       paid_notification_sent_at,
       paid_customer_email_sent_at
     FROM orders
     WHERE public_id = ?
     LIMIT 1`,
    [orderPublicId],
    { cache: "no-store" },
  );

  return orders[0] ?? null;
}

async function markOrderEmailSent(
  orderPublicId: string,
  column: "paid_notification_sent_at" | "paid_customer_email_sent_at",
) {
  await executeCloudflareD1(
    `UPDATE orders
     SET ${column} = COALESCE(${column}, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE public_id = ?`,
    [orderPublicId],
  );
}

async function sendPaidOrderNotificationIfNeeded(order: OrderNotificationOrderRow) {
  if (normalizeText(order.paid_notification_sent_at)) {
    return false;
  }

  const recipient = getZohoOrderNotificationRecipient();
  const items = await getOrderItemsForNotification(order.public_id);
  const redemptions = await getGiftCardRedemptionsForOrder(order.public_id);
  const email = buildOrderNotificationEmail(order, items, redemptions);
  await sendZohoEmail({
    to: recipient,
    from: getZohoOrderNotificationSender(),
    subject: email.subject,
    html: email.html,
  });
  await markOrderEmailSent(order.public_id, "paid_notification_sent_at");
  return true;
}

async function sendPaidOrderCustomerEmailIfNeeded(order: OrderNotificationOrderRow) {
  if (normalizeText(order.paid_customer_email_sent_at)) {
    return false;
  }

  const customerEmail = normalizeText(order.email);
  if (!customerEmail) {
    throw new Error(`Order ${order.public_id} does not have a customer email address.`);
  }

  const items = await getOrderItemsForNotification(order.public_id);
  const redemptions = await getGiftCardRedemptionsForOrder(order.public_id);
  const email = buildPaidOrderCustomerEmail(order, items, redemptions);
  await sendZohoEmail({
    to: customerEmail,
    from: getZohoOrderNotificationSender(),
    subject: email.subject,
    html: email.html,
  });
  await markOrderEmailSent(order.public_id, "paid_customer_email_sent_at");
  return true;
}

export async function ensurePaidOrderEmails(orderPublicId: string) {
  const order = await getOrderForNotification(orderPublicId);
  if (!order) {
    throw new Error(`Order ${orderPublicId} was not found for paid email delivery.`);
  }

  if (normalizeText(order.status).toLowerCase() !== "paid") {
    return { skipped: false as const, notificationSent: false, customerSent: false };
  }

  await issueGiftCardsForPaidOrder(orderPublicId);

  if (!isOrderNotificationEmailConfigured()) {
    console.info("[orders.email] Skipped paid emails because email env is incomplete.", {
      orderPublicId,
    });
    return { skipped: true as const, notificationSent: false, customerSent: false };
  }

  const [notificationSent, customerSent] = await Promise.all([
    sendPaidOrderNotificationIfNeeded(order),
    sendPaidOrderCustomerEmailIfNeeded(order),
  ]);

  return { skipped: false as const, notificationSent, customerSent };
}

async function getOrderItemsForNotification(orderPublicId: string) {
  return queryCloudflareD1<OrderNotificationItemRow>(
    `SELECT
       item.product_slug,
       item.product_name,
       item.quantity,
       item.unit_price_cents,
       item.line_total_cents,
       product.is_gift_card,
       card.code AS gift_card_code
     FROM order_items item
     INNER JOIN orders ord ON ord.id = item.order_id
     LEFT JOIN products product ON product.slug = item.product_slug
     LEFT JOIN gift_cards card ON card.order_item_id = item.id
     WHERE ord.public_id = ?
     ORDER BY item.id ASC`,
    [orderPublicId],
    { cache: "no-store" },
  );
}

function buildGiftCardRedemptionLines(
  order: OrderNotificationOrderRow,
  redemptions: Awaited<ReturnType<typeof getGiftCardRedemptionsForOrder>>,
) {
  return redemptions
    .filter((redemption) => redemption.status === "finalized" || redemption.status === "restored")
    .map((redemption) => {
      const status = redemption.status === "restored" ? " restored" : "";
      return `${redemption.code}: ${formatMoney(redemption.appliedCents, order.currency)}${status}`;
    });
}

function buildGiftCardRedemptionHtmlLines(
  order: OrderNotificationOrderRow,
  redemptions: Awaited<ReturnType<typeof getGiftCardRedemptionsForOrder>>,
) {
  return buildGiftCardRedemptionLines(order, redemptions)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
}

function buildOrderNotificationEmail(
  order: OrderNotificationOrderRow,
  items: OrderNotificationItemRow[],
  redemptions: Awaited<ReturnType<typeof getGiftCardRedemptionsForOrder>>,
) {
  const customerName = [order.first_name, order.last_name].map(normalizeText).filter(Boolean).join(" ");
  const delivery = getOrderDeliveryLabel(order, items);
  const dispatch = getOrderDispatchLabel(order, items);
  const itemLines = items.map((item) => formatOrderItemText(item, order.currency));
  const redemptionLines = buildGiftCardRedemptionLines(order, redemptions);
  const giftCardRedeemedCents = getGiftCardRedeemedCents(order);
  const stripeAmountCents = getStripeAmountCents(order);
  const textSections = [
    `New paid order: ${order.public_id}`,
    "",
    `Customer: ${customerName || "Not provided"}`,
    `Email: ${order.email}`,
    `Phone: ${normalizeText(order.phone) || "Not provided"}`,
    "",
    `${delivery.heading}:`,
    ...delivery.lines,
    ...(dispatch.lines.length > 0 ? ["", `${dispatch.heading}:`, ...dispatch.lines] : []),
    "",
    "Items:",
    ...(itemLines.length > 0 ? itemLines : ["No order lines found"]),
    "",
    `Subtotal: ${formatMoney(order.subtotal_cents, order.currency)}`,
    `Shipping: ${formatMoney(order.shipping_cents, order.currency)}`,
    `Tip: ${formatMoney(order.tip_cents, order.currency)}`,
    `Gross total: ${formatMoney(order.total_cents, order.currency)}`,
    `Gift cards: -${formatMoney(giftCardRedeemedCents, order.currency)}`,
    `Card paid: ${formatMoney(stripeAmountCents, order.currency)}`,
    ...(redemptionLines.length > 0 ? ["", "Gift card redemptions:", ...redemptionLines] : []),
    "",
    `Placed at: ${order.created_at}`,
  ];

  const htmlItems = items
    .map((item) => formatOrderItemHtml(item, order.currency))
    .join("");
  const htmlAddress = delivery.lines
    .map((line) => escapeHtml(line))
    .join("<br />");
  const htmlDispatch = dispatch.lines
    .map((line) => escapeHtml(line))
    .join("<br />");
  const htmlRedemptions = buildGiftCardRedemptionHtmlLines(order, redemptions);

  const html = [
    `<h1>New paid order: ${escapeHtml(order.public_id)}</h1>`,
    "<p>A customer payment has been confirmed.</p>",
    "<h2>Customer</h2>",
    `<p><strong>Name:</strong> ${escapeHtml(customerName || "Not provided")}<br />`,
    `<strong>Email:</strong> ${escapeHtml(order.email)}<br />`,
    `<strong>Phone:</strong> ${escapeHtml(normalizeText(order.phone) || "Not provided")}</p>`,
    `<h2>${escapeHtml(delivery.heading)}</h2>`,
    `<p>${htmlAddress}</p>`,
    ...(dispatch.lines.length > 0
      ? [`<h2>${escapeHtml(dispatch.heading)}</h2>`, `<p>${htmlDispatch}</p>`]
      : []),
    "<h2>Items</h2>",
    `<ul>${htmlItems || "<li>No order lines found</li>"}</ul>`,
    "<h2>Totals</h2>",
    `<p><strong>Subtotal:</strong> ${escapeHtml(formatMoney(order.subtotal_cents, order.currency))}<br />`,
    `<strong>Shipping:</strong> ${escapeHtml(formatMoney(order.shipping_cents, order.currency))}<br />`,
    `<strong>Tip:</strong> ${escapeHtml(formatMoney(order.tip_cents, order.currency))}<br />`,
    `<strong>Gross total:</strong> ${escapeHtml(formatMoney(order.total_cents, order.currency))}<br />`,
    `<strong>Gift cards:</strong> -${escapeHtml(formatMoney(giftCardRedeemedCents, order.currency))}<br />`,
    `<strong>Card paid:</strong> ${escapeHtml(formatMoney(stripeAmountCents, order.currency))}</p>`,
    ...(htmlRedemptions ? ["<h2>Gift card redemptions</h2>", `<ul>${htmlRedemptions}</ul>`] : []),
    `<p><strong>Placed at:</strong> ${escapeHtml(order.created_at)}</p>`,
  ].join("");

  return {
    subject: `New order ${order.public_id}`,
    text: textSections.join("\n"),
    html,
  };
}

function buildPaidOrderCustomerEmail(
  order: OrderNotificationOrderRow,
  items: OrderNotificationItemRow[],
  redemptions: Awaited<ReturnType<typeof getGiftCardRedemptionsForOrder>>,
) {
  const customerName = [order.first_name, order.last_name].map(normalizeText).filter(Boolean).join(" ");
  const delivery = getOrderDeliveryLabel(order, items);
  const dispatch = getOrderDispatchLabel(order, items);
  const hasOnlyGiftCards = items.length > 0 && items.every(isGiftCardItem);
  const placedAtLabel = formatOrderDateTime(order.created_at);
  const itemLines = items.map((item) => formatOrderItemText(item, order.currency));
  const redemptionLines = buildGiftCardRedemptionLines(order, redemptions);
  const giftCardRedeemedCents = getGiftCardRedeemedCents(order);
  const stripeAmountCents = getStripeAmountCents(order);

  const textSections = [
    `Thanks for your order ${order.public_id}`,
    "",
    `Hello ${customerName || "there"},`,
    "",
    hasOnlyGiftCards
      ? "Your payment has been confirmed and your gift card is ready to use."
      : "Your payment has been confirmed and we are preparing your order.",
    "",
    `Order placed: ${placedAtLabel}`,
    `Order number: ${order.public_id}`,
    "",
    `${delivery.heading}:`,
    ...delivery.lines,
    ...(dispatch.lines.length > 0 ? ["", `${dispatch.heading}:`, ...dispatch.lines] : []),
    "",
    "Items:",
    ...(itemLines.length > 0 ? itemLines : ["No order lines found"]),
    "",
    `Subtotal: ${formatMoney(order.subtotal_cents, order.currency)}`,
    `Shipping: ${formatMoney(order.shipping_cents, order.currency)}`,
    `Tip: ${formatMoney(order.tip_cents, order.currency)}`,
    `Gross total: ${formatMoney(order.total_cents, order.currency)}`,
    `Gift cards: -${formatMoney(giftCardRedeemedCents, order.currency)}`,
    `Card paid: ${formatMoney(stripeAmountCents, order.currency)}`,
    ...(redemptionLines.length > 0 ? ["", "Gift card redemptions:", ...redemptionLines] : []),
    "",
    hasOnlyGiftCards
      ? "Your gift card code is ready for checkout when you want to use it."
      : "We will email you again when your order has been delivered.",
  ];

  const htmlItems = items
    .map((item) => formatOrderItemHtml(item, order.currency))
    .join("");
  const htmlAddress = delivery.lines
    .map((line) => escapeHtml(line))
    .join("<br />");
  const htmlDispatch = dispatch.lines
    .map((line) => escapeHtml(line))
    .join("<br />");
  const htmlRedemptions = buildGiftCardRedemptionHtmlLines(order, redemptions);

  const html = [
    `<h1>Thanks for your order ${escapeHtml(order.public_id)}</h1>`,
    `<p>Hello ${escapeHtml(customerName || "there")},</p>`,
    hasOnlyGiftCards
      ? "<p>Your payment has been confirmed and your gift card is ready to use.</p>"
      : "<p>Your payment has been confirmed and we are preparing your order.</p>",
    "<h2>Order details</h2>",
    `<p><strong>Order placed:</strong> ${escapeHtml(placedAtLabel)}<br />`,
    `<strong>Order number:</strong> ${escapeHtml(order.public_id)}</p>`,
    `<h2>${escapeHtml(delivery.heading)}</h2>`,
    `<p>${htmlAddress}</p>`,
    ...(dispatch.lines.length > 0
      ? [`<h2>${escapeHtml(dispatch.heading)}</h2>`, `<p>${htmlDispatch}</p>`]
      : []),
    "<h2>Items</h2>",
    `<ul>${htmlItems || "<li>No order lines found</li>"}</ul>`,
    "<h2>Totals</h2>",
    `<p><strong>Subtotal:</strong> ${escapeHtml(formatMoney(order.subtotal_cents, order.currency))}<br />`,
    `<strong>Shipping:</strong> ${escapeHtml(formatMoney(order.shipping_cents, order.currency))}<br />`,
    `<strong>Tip:</strong> ${escapeHtml(formatMoney(order.tip_cents, order.currency))}<br />`,
    `<strong>Gross total:</strong> ${escapeHtml(formatMoney(order.total_cents, order.currency))}<br />`,
    `<strong>Gift cards:</strong> -${escapeHtml(formatMoney(giftCardRedeemedCents, order.currency))}<br />`,
    `<strong>Card paid:</strong> ${escapeHtml(formatMoney(stripeAmountCents, order.currency))}</p>`,
    ...(htmlRedemptions ? ["<h2>Gift card redemptions</h2>", `<ul>${htmlRedemptions}</ul>`] : []),
    hasOnlyGiftCards
      ? "<p>Your gift card code is ready for checkout when you want to use it.</p>"
      : "<p>We will email you again when your order has been delivered.</p>",
  ].join("");

  return {
    subject: `Your Grown Cookies order ${order.public_id} is confirmed`,
    text: textSections.join("\n"),
    html,
  };
}

function buildDeliveredOrderEmail(
  order: OrderNotificationOrderRow,
  items: OrderNotificationItemRow[],
  redemptions: Awaited<ReturnType<typeof getGiftCardRedemptionsForOrder>>,
) {
  const customerName = [order.first_name, order.last_name].map(normalizeText).filter(Boolean).join(" ");
  const addressLines = buildAddressLines(order);
  const dispatch = getOrderDispatchLabel(order, items);
  const itemLines = items.map((item) => {
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
    const unitPrice = formatMoney(item.unit_price_cents, order.currency);
    const lineTotal = formatMoney(item.line_total_cents, order.currency);
    return `${quantity} x ${item.product_name} - ${unitPrice} each - ${lineTotal}`;
  });
  const deliveredAt = normalizeText(order.delivered_at);
  const deliveredAtLabel = deliveredAt ? formatOrderDateTime(deliveredAt) : "Just now";
  const placedAtLabel = formatOrderDateTime(order.created_at);
  const redemptionLines = buildGiftCardRedemptionLines(order, redemptions);
  const giftCardRedeemedCents = getGiftCardRedeemedCents(order);
  const stripeAmountCents = getStripeAmountCents(order);

  const textSections = [
    `Your order ${order.public_id} has been delivered`,
    "",
    `Hello ${customerName || "there"},`,
    "",
    "Your Grown Cookies order has been marked as delivered.",
    "",
    `Delivered at: ${deliveredAtLabel}`,
    `Order placed: ${placedAtLabel}`,
    `Order number: ${order.public_id}`,
    "",
    "Delivery details:",
    ...(addressLines.length > 0 ? addressLines : ["Not provided"]),
    ...(dispatch.lines.length > 0 ? ["", `${dispatch.heading}:`, ...dispatch.lines] : []),
    "",
    "Items:",
    ...(itemLines.length > 0 ? itemLines : ["No order lines found"]),
    "",
    `Subtotal: ${formatMoney(order.subtotal_cents, order.currency)}`,
    `Shipping: ${formatMoney(order.shipping_cents, order.currency)}`,
    `Tip: ${formatMoney(order.tip_cents, order.currency)}`,
    `Gross total: ${formatMoney(order.total_cents, order.currency)}`,
    `Gift cards: -${formatMoney(giftCardRedeemedCents, order.currency)}`,
    `Card paid: ${formatMoney(stripeAmountCents, order.currency)}`,
    ...(redemptionLines.length > 0 ? ["", "Gift card redemptions:", ...redemptionLines] : []),
    "",
    "If anything is missing or wrong with your delivery, reply to this email and we will help.",
  ];

  const htmlItems = items
    .map((item) => {
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
      const name = escapeHtml(`${quantity} x ${item.product_name}`);
      const unitPrice = escapeHtml(formatMoney(item.unit_price_cents, order.currency));
      const lineTotal = escapeHtml(formatMoney(item.line_total_cents, order.currency));
      return `<li>${name}<br /><span>Unit price: ${unitPrice}</span><br /><strong>Line total: ${lineTotal}</strong></li>`;
    })
    .join("");
  const htmlAddress = (addressLines.length > 0 ? addressLines : ["Not provided"])
    .map((line) => escapeHtml(line))
    .join("<br />");
  const htmlDispatch = dispatch.lines
    .map((line) => escapeHtml(line))
    .join("<br />");
  const htmlRedemptions = buildGiftCardRedemptionHtmlLines(order, redemptions);

  const html = [
    `<h1>Your order ${escapeHtml(order.public_id)} has been delivered</h1>`,
    `<p>Hello ${escapeHtml(customerName || "there")},</p>`,
    "<p>Your Grown Cookies order has been marked as delivered.</p>",
    "<h2>Order details</h2>",
    `<p><strong>Delivered at:</strong> ${escapeHtml(deliveredAtLabel)}<br />`,
    `<strong>Order placed:</strong> ${escapeHtml(placedAtLabel)}<br />`,
    `<strong>Order number:</strong> ${escapeHtml(order.public_id)}</p>`,
    "<h2>Delivery details</h2>",
    `<p>${htmlAddress}</p>`,
    ...(dispatch.lines.length > 0
      ? [`<h2>${escapeHtml(dispatch.heading)}</h2>`, `<p>${htmlDispatch}</p>`]
      : []),
    "<h2>Items</h2>",
    `<ul>${htmlItems || "<li>No order lines found</li>"}</ul>`,
    "<h2>Totals</h2>",
    `<p><strong>Subtotal:</strong> ${escapeHtml(formatMoney(order.subtotal_cents, order.currency))}<br />`,
    `<strong>Shipping:</strong> ${escapeHtml(formatMoney(order.shipping_cents, order.currency))}<br />`,
    `<strong>Tip:</strong> ${escapeHtml(formatMoney(order.tip_cents, order.currency))}<br />`,
    `<strong>Gross total:</strong> ${escapeHtml(formatMoney(order.total_cents, order.currency))}<br />`,
    `<strong>Gift cards:</strong> -${escapeHtml(formatMoney(giftCardRedeemedCents, order.currency))}<br />`,
    `<strong>Card paid:</strong> ${escapeHtml(formatMoney(stripeAmountCents, order.currency))}</p>`,
    ...(htmlRedemptions ? ["<h2>Gift card redemptions</h2>", `<ul>${htmlRedemptions}</ul>`] : []),
    "<p>If anything is missing or wrong with your delivery, reply to this email and we will help.</p>",
  ].join("");

  return {
    subject: `Your Grown Cookies order ${order.public_id} has been delivered`,
    text: textSections.join("\n"),
    html,
  };
}

export async function sendPaidOrderNotification(orderPublicId: string) {
  if (!isOrderNotificationEmailConfigured()) {
    console.info("[orders.email] Skipped notification because email env is incomplete.", {
      orderPublicId,
    });
    return { skipped: true as const };
  }

  const order = await getOrderForNotification(orderPublicId);
  if (!order) {
    throw new Error(`Order ${orderPublicId} was not found for notification.`);
  }
  await sendPaidOrderNotificationIfNeeded(order);

  return { skipped: false as const };
}

export async function sendPaidOrderCustomerEmail(orderPublicId: string) {
  if (!isOrderNotificationEmailConfigured()) {
    console.info("[orders.email] Skipped customer paid email because email env is incomplete.", {
      orderPublicId,
    });
    return { skipped: true as const };
  }

  const order = await getOrderForNotification(orderPublicId);
  if (!order) {
    throw new Error(`Order ${orderPublicId} was not found for customer confirmation email.`);
  }
  await sendPaidOrderCustomerEmailIfNeeded(order);

  return { skipped: false as const };
}

export async function sendDeliveredOrderEmail(orderPublicId: string) {
  if (!isOrderNotificationEmailConfigured()) {
    console.info("[orders.email] Skipped delivered email because email env is incomplete.", {
      orderPublicId,
    });
    return { skipped: true as const };
  }

  const order = await getOrderForNotification(orderPublicId);
  if (!order) {
    throw new Error(`Order ${orderPublicId} was not found for delivery email.`);
  }

  const customerEmail = normalizeText(order.email);
  if (!customerEmail) {
    throw new Error(`Order ${orderPublicId} does not have a customer email address.`);
  }

  const items = await getOrderItemsForNotification(orderPublicId);
  const redemptions = await getGiftCardRedemptionsForOrder(orderPublicId);
  const email = buildDeliveredOrderEmail(order, items, redemptions);
  await sendZohoEmail({
    to: customerEmail,
    from: getZohoOrderNotificationSender(),
    subject: email.subject,
    html: email.html,
  });

  return { skipped: false as const };
}
