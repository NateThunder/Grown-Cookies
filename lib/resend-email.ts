const DEFAULT_ORDERS_EMAIL = "orders@growncookies.co.uk";
const RESEND_API_URL = "https://api.resend.com/emails";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getDefaultOrdersEmailRecipient() {
  return DEFAULT_ORDERS_EMAIL;
}

export function getResendApiKey() {
  return normalizeText(process.env.RESEND_API_KEY);
}

export function getOrderNotificationSender() {
  return normalizeText(process.env.ORDER_NOTIFICATION_FROM);
}

export function getOrderNotificationRecipient() {
  return normalizeText(process.env.ORDER_NOTIFICATION_TO) || DEFAULT_ORDERS_EMAIL;
}

export function getContactFormRecipient() {
  return normalizeText(process.env.CONTACT_FORM_TO) || DEFAULT_ORDERS_EMAIL;
}

export function isResendConfigured() {
  return Boolean(getResendApiKey() && getOrderNotificationSender());
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export async function sendResendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  const apiKey = getResendApiKey();
  const sender = getOrderNotificationSender();

  if (!apiKey || !sender) {
    throw new Error("Resend email is not configured.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: Array.isArray(input.to) ? input.to : [input.to],
      reply_to: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${errorText}`);
  }
}
