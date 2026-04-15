import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGiftCard } from "@/lib/gift-cards";
import { ADMIN_AUTH_COOKIE, getAdminUserFromAccessToken } from "@/lib/supabase/admin-auth";

type CreateGiftCardPayload = {
  initialAmountPence?: unknown;
};

async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const adminUser = await getAdminUserFromAccessToken(accessToken);

  return Boolean(adminUser);
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
