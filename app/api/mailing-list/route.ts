import { NextResponse } from "next/server";
import {
  isValidMailingListEmail,
  MailingListDuplicateSubscriberError,
  MailingListStorageError,
  normalizeMailingListEmail,
  subscribeToMailingList,
} from "@/lib/mailing-list";

export const runtime = "nodejs";

const MAILING_LIST_FALLBACK_MESSAGE =
  "Mailing list signup is temporarily unavailable. Please try again later.";

type MailingListPayload = {
  email?: unknown;
  source?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MailingListPayload;
    const email = normalizeMailingListEmail(body.email);

    if (!email || !isValidMailingListEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    await subscribeToMailingList({
      email,
      source: normalizeText(body.source) || "footer",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MailingListDuplicateSubscriberError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof MailingListStorageError) {
      return NextResponse.json(
        { error: MAILING_LIST_FALLBACK_MESSAGE },
        { status: 503 },
      );
    }

    console.error("Mailing list signup failed.", error);

    return NextResponse.json({ error: MAILING_LIST_FALLBACK_MESSAGE }, { status: 500 });
  }
}
