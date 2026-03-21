import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  STRIPE_CHECKOUT_COSTS,
  createPendingStripeOrder,
  setOrderPaymentIntentId,
  type StripeCheckoutContactInput,
  type StripeCheckoutDeliveryInput,
} from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMoney(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
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

function parseItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Your basket is empty.");
  }

  return raw.map((line) => {
    if (!line || typeof line !== "object") {
      throw new Error("Invalid basket item.");
    }

    const slug = normalizeText((line as { slug?: unknown }).slug);
    const quantity = normalizeInteger((line as { quantity?: unknown }).quantity);

    if (!slug || quantity <= 0) {
      throw new Error("Invalid basket item.");
    }

    return { slug, quantity };
  });
}

function parseReturnUrlBase(raw: unknown) {
  const value = normalizeText(raw).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("Return URL is invalid.");
  }

  return value;
}

function getCountryName(code: string) {
  const normalized = normalizeText(code).toUpperCase();
  if (!normalized) {
    return "";
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

function getContactFromConfirmationToken(
  token: Stripe.ConfirmationToken,
  fallback: { email?: string; phone?: string },
): StripeCheckoutContactInput {
  const billingDetails = token.payment_method_preview?.billing_details;
  const email = normalizeText(billingDetails?.email) || normalizeText(fallback.email);

  if (!email) {
    throw new Error("Express checkout did not return an email address.");
  }

  return {
    email,
    phone:
      normalizeText(token.shipping?.phone) ||
      normalizeText(billingDetails?.phone) ||
      normalizeText(fallback.phone),
  };
}

function getDeliveryFromConfirmationToken(
  token: Stripe.ConfirmationToken,
): StripeCheckoutDeliveryInput {
  const shipping = token.shipping;
  const name = normalizeText(shipping?.name);
  const nameParts = name.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || firstName;
  const address = shipping?.address;

  if (
    !firstName ||
    !lastName ||
    !normalizeText(address?.line1) ||
    !normalizeText(address?.city) ||
    !normalizeText(address?.postal_code) ||
    !normalizeText(address?.country)
  ) {
    throw new Error("Express checkout did not return a complete delivery address.");
  }

  return {
    firstName,
    lastName,
    address: normalizeText(address?.line1),
    flatNumber: normalizeText(address?.line2),
    city: normalizeText(address?.city),
    postcode: normalizeText(address?.postal_code),
    country: getCountryName(normalizeText(address?.country)),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: unknown;
      tipCents?: unknown;
      confirmationTokenId?: unknown;
      returnUrlBase?: unknown;
      fallbackContact?: {
        email?: unknown;
        phone?: unknown;
      };
    };

    const confirmationTokenId = normalizeText(body.confirmationTokenId);
    if (!confirmationTokenId) {
      throw new Error("Express checkout could not be initialized.");
    }

    const items = parseItems(body.items);
    const returnUrlBase = parseReturnUrlBase(body.returnUrlBase);
    const stripe = getStripeClient();
    const confirmationToken = await stripe.confirmationTokens.retrieve(confirmationTokenId);

    const contact = getContactFromConfirmationToken(confirmationToken, {
      email: normalizeText(body.fallbackContact?.email),
      phone: normalizeText(body.fallbackContact?.phone),
    });
    const delivery = getDeliveryFromConfirmationToken(confirmationToken);

    const draft = await createPendingStripeOrder({
      items,
      contact,
      delivery,
      tipCents: normalizeMoney(body.tipCents),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: draft.totalCents,
      currency: STRIPE_CHECKOUT_COSTS.currency,
      confirm: true,
      confirmation_token: confirmationTokenId,
      payment_method_types: ["card", "paypal"],
      return_url: `${returnUrlBase}/checkout/success?orderId=${draft.orderPublicId}`,
      metadata: {
        orderId: draft.orderPublicId,
        source: "grown-cookies-express",
      },
      description: `Order ${draft.orderPublicId}`,
    });

    if (!paymentIntent.client_secret || !paymentIntent.id) {
      return NextResponse.json({ error: "Could not initialize payment." }, { status: 500 });
    }

    await setOrderPaymentIntentId(draft.orderPublicId, paymentIntent.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: draft.orderPublicId,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not complete express checkout." }, { status: 400 });
  }
}
