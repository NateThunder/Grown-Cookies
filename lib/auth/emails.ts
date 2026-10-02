import { sendZohoEmail } from "@/lib/zoho-contact-email";

const AUTH_EMAIL_FROM = "orders@growncookies.co.uk";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function authEmailHtml({
  greetingName,
  intro,
  actionLabel,
  url,
  expiry,
}: {
  greetingName: string;
  intro: string;
  actionLabel: string;
  url: string;
  expiry: string;
}) {
  const safeName = escapeHtml(greetingName || "there");
  const safeUrl = escapeHtml(url);

  return `
    <div style="font-family:Arial,sans-serif;color:#241b16;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">
      <p>Hi ${safeName},</p>
      <p>${escapeHtml(intro)}</p>
      <p style="margin:28px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#241b16;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">
          ${escapeHtml(actionLabel)}
        </a>
      </p>
      <p>This link expires ${escapeHtml(expiry)}. If you did not request this, you can ignore this email.</p>
      <p>Grown Cookies</p>
    </div>
  `.trim();
}

export async function sendAccountVerificationEmail(input: {
  to: string;
  name: string;
  url: string;
}) {
  await sendZohoEmail({
    to: input.to,
    from: AUTH_EMAIL_FROM,
    subject: "Verify your Grown Cookies email",
    html: authEmailHtml({
      greetingName: input.name,
      intro: "Verify your email address to finish setting up your Grown Cookies account.",
      actionLabel: "Verify email",
      url: input.url,
      expiry: "in 24 hours",
    }),
  });
}
export async function sendAccountPasswordResetEmail(input: {
  to: string;
  name: string;
  url: string;
}) {
  await sendZohoEmail({
    to: input.to,
    from: AUTH_EMAIL_FROM,
    subject: "Reset your Grown Cookies password",
    html: authEmailHtml({
      greetingName: input.name,
      intro: "Use the link below to set a new password for your Grown Cookies account.",
      actionLabel: "Set a new password",
      url: input.url,
      expiry: "in one hour",
    }),
  });
}
