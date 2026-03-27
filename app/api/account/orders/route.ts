import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import { getAccountOrderSummariesForCustomer } from "@/lib/account-orders";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";

export async function GET(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = user?.email?.trim().toLowerCase() ?? "";
  const supabaseUserId = user?.id?.trim() ?? "";

  if (!email || !supabaseUserId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await ensureCustomerProfileForUser(user);
    const orders = await getAccountOrderSummariesForCustomer({
      supabaseUserId: profile.supabaseUserId,
      email,
    });
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { error: "We could not load your order history right now." },
      { status: 500 },
    );
  }
}
