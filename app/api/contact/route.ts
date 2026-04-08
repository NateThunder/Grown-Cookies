import { NextResponse } from "next/server";
import {
  getContactFormRecipient,
  getDefaultOrdersEmailRecipient,
  isProductionEnvironment,
  isResendConfigured,
  sendResendEmail,
} from "@/lib/resend-email";
import { isZohoContactEmailConfigured, sendZohoContactEmail } from "@/lib/zoho-contact-email";

export const runtime = "nodejs";
const CONTACT_FALLBACK_MESSAGE =
  "The enquiry form is temporarily unavailable. Please email orders@growncookies.co.uk directly.";

type ContactFormPayload = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  subject?: unknown;
  message?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactFormPayload;
    const name = normalizeText(body.name);
    const email = normalizeText(body.email);
    const phone = normalizeText(body.phone);
    const subject = normalizeText(body.subject) || "Order enquiry";
    const message = normalizeText(body.message);

    if (!name) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (!message || message.length < 10) {
      return NextResponse.json(
        { error: "Enter a message with at least 10 characters." },
        { status: 400 },
      );
    }

    const recipient = getContactFormRecipient();
    const text = [
      `New contact enquiry for ${getDefaultOrdersEmailRecipient()}`,
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "Not provided"}`,
      `Subject: ${subject}`,
      "",
      "Message:",
      message,
    ].join("\n");
    const html = [
      `<h1>New contact enquiry</h1>`,
      `<p><strong>Name:</strong> ${escapeHtml(name)}<br />`,
      `<strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br />`,
      `<strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}<br />`,
      `<strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
      `<h2>Message</h2>`,
      `<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`,
    ].join("");

    if (isZohoContactEmailConfigured()) {
      try {
        await sendZohoContactEmail({
          subject: `Contact form: ${subject}`,
          html,
        });

        return NextResponse.json({ ok: true });
      } catch (error) {
        console.error("Zoho contact email delivery failed.", {
          error,
          recipient,
          subject,
          customerEmail: email,
        });

        if (!isResendConfigured()) {
          throw error;
        }
      }
    }

    if (!isResendConfigured()) {
      if (isProductionEnvironment()) {
        return NextResponse.json(
          { error: CONTACT_FALLBACK_MESSAGE },
          { status: 500 },
        );
      }

      console.info("Contact enquiry captured locally without email delivery.", {
        recipient: getContactFormRecipient(),
        name,
        email,
        phone: phone || "Not provided",
        subject,
        message,
      });

      return NextResponse.json({
        ok: true,
        notice: "Email delivery is not configured in this environment. Submission logged locally only.",
      });
    }

    await sendResendEmail({
      to: recipient,
      replyTo: email,
      subject: `Contact form: ${subject}`,
      text,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? CONTACT_FALLBACK_MESSAGE : "Unable to send your message.";

    console.error("Contact enquiry submission failed.", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
