import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";
import {
  createSetupIntentForCustomer,
  ensureStripeCustomerForProfile,
} from "@/lib/stripe-customer-payment-methods";

export async function POST(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await ensureCustomerProfileForUser(user, {
      linkOrdersByEmail: false,
      syncMissingProfileFields: false,
    });
    const stripeCustomerId = await ensureStripeCustomerForProfile(profile);
    const setupIntent = await createSetupIntentForCustomer(stripeCustomerId);
    return NextResponse.json(setupIntent);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "We could not start payment method setup right now.",
      },
      { status: 400 },
    );
  }
}
