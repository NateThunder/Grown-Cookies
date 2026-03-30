import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";
import {
  detachSavedPaymentMethod,
  listSavedPaymentMethodsForProfile,
} from "@/lib/stripe-customer-payment-methods";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
    const paymentMethods = await listSavedPaymentMethodsForProfile(profile);
    return NextResponse.json({ paymentMethods });
  } catch {
    return NextResponse.json(
      { error: "We could not load your saved payment methods right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { action?: unknown; paymentMethodId?: unknown };
    const action = normalizeText(body.action).toLowerCase();
    const paymentMethodId = normalizeText(body.paymentMethodId);

    if (action !== "detach" || !paymentMethodId) {
      throw new Error("Saved payment method not found.");
    }

    const profile = await ensureCustomerProfileForUser(user, {
      linkOrdersByEmail: false,
      syncMissingProfileFields: false,
    });
    const stripeCustomerId = profile.stripeCustomerId.trim();

    if (!stripeCustomerId) {
      throw new Error("Saved payment method not found.");
    }

    await detachSavedPaymentMethod(stripeCustomerId, paymentMethodId);
    const paymentMethods = await listSavedPaymentMethodsForProfile(profile);

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We could not update your saved payment methods right now.",
      },
      { status: 400 },
    );
  }
}
