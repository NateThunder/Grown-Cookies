import { NextResponse } from "next/server";
import { getAccountOrderSummariesByEmail } from "@/lib/account-orders";
import { getSupabaseUserFromAccessToken } from "@/lib/supabase/admin-auth";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await getSupabaseUserFromAccessToken(accessToken);
  const email = user?.email?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const orders = await getAccountOrderSummariesByEmail(email);
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { error: "We could not load your order history right now." },
      { status: 500 },
    );
  }
}
