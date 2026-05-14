import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGiftCard } from "@/lib/gift-cards";
import { ADMIN_AUTH_COOKIE, getAdminUserFromAccessToken } from "@/lib/supabase/admin-auth";

type CreateGiftCardPayload = {
  initialAmountPence?: unknown;
};

const ADMIN_CSRF_HEADER = "x-gc-admin-csrf";
const ADMIN_CSRF_HEADER_VALUE = "1";

async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const adminUser = await getAdminUserFromAccessToken(accessToken);

  return Boolean(adminUser);
}

function hasJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().split(";")[0].trim() === "application/json";
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function hasCsrfHeader(request: Request) {
  return request.headers.get(ADMIN_CSRF_HEADER) === ADMIN_CSRF_HEADER_VALUE;
}

function parseAmountPence(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  throw new Error("Enter a valid gift card amount in pence.");
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request) || !hasJsonContentType(request) || !hasCsrfHeader(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      throw new Error("Enter a valid gift card request.");
    }

    const payload = body as CreateGiftCardPayload;
    const giftCard = await createGiftCard({
      initialAmountPence: parseAmountPence(payload.initialAmountPence),
    });

    return NextResponse.json({ giftCard }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The gift card could not be created.",
      },
      { status: 400 },
    );
  }
}
