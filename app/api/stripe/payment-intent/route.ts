import Stripe from "stripe";
import { NextResponse } from "next/server";
import { parseQuoteItems, parseQuoteTip } from "@/lib/checkout-quote";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";
import {
  STRIPE_CHECKOUT_COSTS,
  createPendingStripeOrder,
  setOrderPaymentIntentId,
  type StripeCheckoutContactInput,
  type StripeCheckoutDeliveryInput,
  type StripeCheckoutPayload,
} from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
}

function parseContact(raw: unknown): StripeCheckoutContactInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Contact details are required.");
  }

  const email = normalizeText((raw as { email?: unknown }).email);
  if (!email) {
    throw new Error("Email is required.");
  }

  return {
    email,
    phone: normalizeText((raw as { phone?: unknown }).phone),
  };
}

function parseDelivery(raw: unknown): StripeCheckoutDeliveryInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Delivery details are required.");
  }

  const firstName = normalizeText((raw as { firstName?: unknown }).firstName);
  const lastName = normalizeText((raw as { lastName?: unknown }).lastName);
  const address = normalizeText((raw as { address?: unknown }).address);
  const city = normalizeText((raw as { city?: unknown }).city);
  const postcode = normalizeText((raw as { postcode?: unknown }).postcode);
  const country = normalizeText((raw as { country?: unknown }).country);

  if (!firstName || !lastName || !address || !city || !postcode || !country) {
    throw new Error("Delivery details are incomplete.");
  }

  return {
    firstName,
    lastName,
    address,
    flatNumber: normalizeText((raw as { flatNumber?: unknown }).flatNumber),
    city,
    postcode,
    country,
  };
}

function parseItems(raw: unknown) {
  return parseQuoteItems(raw);
}

function parsePayload(raw: unknown): StripeCheckoutPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Checkout payload is invalid.");
  }

  const payload = raw as {
    items?: unknown;
    contact?: unknown;
    delivery?: unknown;
    tip?: unknown;
  };

  return {
    items: parseItems(payload.items),
    contact: parseContact(payload.contact),
    delivery: parseDelivery(payload.delivery),
    tip: parseQuoteTip(payload.tip),
  };
}

function getPublishableKey() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new Error("Stripe publishable key is missing.");
  }

  return publishableKey;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parsePayload(body);
    const authenticatedUser = await getAuthenticatedSupabaseUser(request);
    const customerProfile = authenticatedUser
      ? await ensureCustomerProfileForUser(authenticatedUser)
      : null;

    const draft = await createPendingStripeOrder({
      ...payload,
      customer: customerProfile
        ? {
            supabaseUserId: customerProfile.supabaseUserId,
            customerProfileId: customerProfile.id,
          }
        : undefined,
    });
    const stripe = getStripeClient();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: draft.totalCents,
      currency: STRIPE_CHECKOUT_COSTS.currency,
      payment_method_types: ["card"],
      metadata: {
        orderId: draft.orderPublicId,
        source: "grown-cookies",
      },
      description: `Order ${draft.orderPublicId}`,
    });

    if (!paymentIntent.client_secret || !paymentIntent.id) {
      return NextResponse.json({ error: "Could not initialize payment." }, { status: 500 });
    }

    await setOrderPaymentIntentId(draft.orderPublicId, paymentIntent.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: getPublishableKey(),
      orderId: draft.orderPublicId,
      totalCents: draft.totalCents,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not create payment." }, { status: 400 });
  }
}
