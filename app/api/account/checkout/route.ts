import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import {
  ensureCustomerProfileForUser,
  listCustomerAddressesForProfileId,
} from "@/lib/customer-profiles";
import { listSavedPaymentMethodsForProfile } from "@/lib/stripe-customer-payment-methods";

export async function GET(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await ensureCustomerProfileForUser(user, {
      linkOrdersByEmail: false,
      syncMissingProfileFields: false,
    });

    const [addresses, paymentMethods] = await Promise.all([
      listCustomerAddressesForProfileId(profile.id),
      listSavedPaymentMethodsForProfile(profile),
    ]);

    return NextResponse.json({
      profile,
      addresses,
      paymentMethods,
    });
  } catch {
    return NextResponse.json(
      { error: "We could not load your saved checkout details." },
      { status: 500 },
    );
  }
}
