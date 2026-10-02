import { NextResponse } from "next/server";
import { getAuthenticatedAccountUser } from "@/lib/account-auth";
import { getAccountOrderSummariesForCustomer } from "@/lib/account-orders";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";

export async function GET(request: Request) {
  const user = await getAuthenticatedAccountUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = user?.email?.trim().toLowerCase() ?? "";
  const authUserId = user?.id?.trim() ?? "";

  if (!email || !authUserId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await ensureCustomerProfileForUser(user);
    const orders = await getAccountOrderSummariesForCustomer({
      authUserId: profile.authUserId,
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
