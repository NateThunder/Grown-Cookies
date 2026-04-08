const DEFAULT_ORDERS_EMAIL = "orders@growncookies.co.uk";
const ZOHO_TOKEN_URL = "https://accounts.zoho.eu/oauth/v2/token";
const ZOHO_MAIL_API_BASE_URL = "https://mail.zoho.eu/api/accounts";

export const missingZohoContactEmailEnvMessage =
  "Missing Zoho contact email environment variables. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ACCOUNT_ID.";

type ZohoContactEmailConfig = {
  zohoClientId: string;
  zohoClientSecret: string;
  zohoRefreshToken: string;
  zohoAccountId: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireEnv(name: string) {
  const value = normalizeText(process.env[name]);

  if (!value) {
    throw new Error(missingZohoContactEmailEnvMessage);
  }

  return value;
}

function getZohoContactEmailConfig(): ZohoContactEmailConfig {
  return {
    zohoClientId: requireEnv("ZOHO_CLIENT_ID"),
    zohoClientSecret: requireEnv("ZOHO_CLIENT_SECRET"),
    zohoRefreshToken: requireEnv("ZOHO_REFRESH_TOKEN"),
    zohoAccountId: requireEnv("ZOHO_ACCOUNT_ID"),
  };
}

export function isZohoContactEmailConfigured() {
  try {
    getZohoContactEmailConfig();
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === missingZohoContactEmailEnvMessage) {
      return false;
    }

    throw error;
  }
}

async function getZohoAccessToken(config: ZohoContactEmailConfig) {
  const tokenResponse = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.zohoClientId,
      client_secret: config.zohoClientSecret,
      refresh_token: config.zohoRefreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const responseText = await tokenResponse.text();
    throw new Error(`Zoho token refresh failed: ${responseText}`);
  }

  const tokenBody = (await tokenResponse.json().catch(() => null)) as { access_token?: string } | null;

  if (!tokenBody?.access_token) {
    throw new Error("Zoho token refresh failed: missing access token.");
  }

  return tokenBody.access_token;
}

export function getZohoContactFormRecipient() {
  return normalizeText(process.env.CONTACT_FORM_TO) || DEFAULT_ORDERS_EMAIL;
}

export function getZohoContactFormSender() {
  return normalizeText(process.env.CONTACT_FORM_FROM) || getZohoContactFormRecipient();
}

export function getZohoOrderNotificationRecipient() {
  return normalizeText(process.env.ORDER_NOTIFICATION_TO) || DEFAULT_ORDERS_EMAIL;
}

export function getZohoOrderNotificationSender() {
  return normalizeText(process.env.ORDER_NOTIFICATION_FROM) || DEFAULT_ORDERS_EMAIL;
}

export async function sendZohoEmail(input: {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
}) {
  const config = getZohoContactEmailConfig();
  const accessToken = await getZohoAccessToken(config);
  const toAddress = (Array.isArray(input.to) ? input.to : [input.to])
    .map(normalizeText)
    .filter(Boolean)
    .join(", ");
  const fromAddress = normalizeText(input.from) || DEFAULT_ORDERS_EMAIL;

  if (!toAddress) {
    throw new Error("Zoho Mail send failed: missing recipient.");
  }

  const emailResponse = await fetch(`${ZOHO_MAIL_API_BASE_URL}/${config.zohoAccountId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: JSON.stringify({
      fromAddress,
      toAddress,
      subject: input.subject,
      content: input.html,
      mailFormat: "html",
    }),
  });

  if (!emailResponse.ok) {
    const responseText = await emailResponse.text();
    throw new Error(`Zoho Mail send failed with ${emailResponse.status}: ${responseText}`);
  }

  await emailResponse.text().catch(() => null);
}

export async function sendZohoContactEmail(input: {
  subject: string;
  html: string;
}) {
  return sendZohoEmail({
    to: getZohoContactFormRecipient(),
    from: getZohoContactFormSender(),
    subject: input.subject,
    html: input.html,
  });
}
