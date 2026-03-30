import Stripe from "stripe";
import { NextResponse } from "next/server";
import { parseQuoteItems, parseQuoteTip } from "@/lib/checkout-quote";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";
import {
  ensureStripeCustomerForProfile,
  getStripeClient,
} from "@/lib/stripe-customer-payment-methods";
import {
  STRIPE_CHECKOUT_COSTS,
  createPendingStripeOrder,
  setOrderPaymentIntentId,
  type StripeCheckoutContactInput,
  type StripeCheckoutDeliveryInput,
} from "@/lib/stripe-checkout";

export const runtime = "nodejs";

const SUPPORTED_COUNTRIES = {
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
} as const;

type FallbackContact = {
  email: string;
  phone: string;
};

type FallbackDelivery = {
  firstName: string;
  lastName: string;
  address: string;
  flatNumber: string;
  city: string;
  postcode: string;
  country: string;
} | null;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseItems(raw: unknown) {
  return parseQuoteItems(raw);
}

function parseReturnUrlBase(raw: unknown) {
  const value = normalizeText(raw).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("Return URL is invalid.");
  }

  return value;
}

function parseFallbackContact(raw: unknown): FallbackContact {
  if (!raw || typeof raw !== "object") {
    return { email: "", phone: "" };
  }

  return {
    email: normalizeText((raw as { email?: unknown }).email),
    phone: normalizeText((raw as { phone?: unknown }).phone),
  };
}

function parseFallbackDelivery(raw: unknown): FallbackDelivery {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const delivery = {
    firstName: normalizeText((raw as { firstName?: unknown }).firstName),
    lastName: normalizeText((raw as { lastName?: unknown }).lastName),
    address: normalizeText((raw as { address?: unknown }).address),
    flatNumber: normalizeText((raw as { flatNumber?: unknown }).flatNumber),
    city: normalizeText((raw as { city?: unknown }).city),
    postcode: normalizeText((raw as { postcode?: unknown }).postcode),
    country: normalizeText((raw as { country?: unknown }).country),
  };

  return Object.values(delivery).some(Boolean) ? delivery : null;
}

function normalizeSupportedCountry(raw: string) {
  const upper = normalizeText(raw).toUpperCase();
  if (upper in SUPPORTED_COUNTRIES) {
    return SUPPORTED_COUNTRIES[upper as keyof typeof SUPPORTED_COUNTRIES];
  }

  const normalized = normalizeText(raw).toLowerCase();
  const match = Object.values(SUPPORTED_COUNTRIES).find(
    (label) => label.toLowerCase() === normalized,
  );

  return match ?? "";
}

function requireSupportedCountry(raw: string) {
  const country = normalizeSupportedCountry(raw);
  if (!country) {
    throw new Error("We only deliver to the United Kingdom, United States, and Canada.");
  }

  return country;
}

function splitName(fullName: string, fallbackDelivery: FallbackDelivery) {
  const normalizedFullName = normalizeText(fullName);
  if (normalizedFullName) {
    const parts = normalizedFullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || firstName;
    return { firstName, lastName };
  }

  return {
    firstName: normalizeText(fallbackDelivery?.firstName),
    lastName: normalizeText(fallbackDelivery?.lastName),
  };
}

function getContactFromConfirmationToken(
  token: Stripe.ConfirmationToken,
  fallbackContact: FallbackContact,
): StripeCheckoutContactInput {
  const billingDetails = token.payment_method_preview?.billing_details;
  const email = normalizeText(billingDetails?.email) || normalizeText(fallbackContact.email);

  if (!email) {
    throw new Error("Email is required.");
  }

  return {
    email,
    phone:
      normalizeText(token.shipping?.phone) ||
      normalizeText(billingDetails?.phone) ||
      normalizeText(fallbackContact.phone),
  };
}

function getContactFromSources(
  token: Stripe.ConfirmationToken | null,
  fallbackContact: FallbackContact,
): StripeCheckoutContactInput {
  if (token) {
    return getContactFromConfirmationToken(token, fallbackContact);
  }

  const email = normalizeText(fallbackContact.email);
  if (!email) {
    throw new Error("Email is required.");
  }

  return {
    email,
    phone: normalizeText(fallbackContact.phone),
  };
}

function getDeliveryFromSources(
  token: Stripe.ConfirmationToken | null,
  fallbackDelivery: FallbackDelivery,
): StripeCheckoutDeliveryInput {
  const shipping = token?.shipping;
  const address = shipping?.address;
  const { firstName, lastName } = splitName(normalizeText(shipping?.name), fallbackDelivery);
  const delivery = {
    firstName,
    lastName,
    address: normalizeText(address?.line1) || normalizeText(fallbackDelivery?.address),
    flatNumber: normalizeText(address?.line2) || normalizeText(fallbackDelivery?.flatNumber),
    city: normalizeText(address?.city) || normalizeText(fallbackDelivery?.city),
    postcode: normalizeText(address?.postal_code) || normalizeText(fallbackDelivery?.postcode),
    country: requireSupportedCountry(
      normalizeText(address?.country) || normalizeText(fallbackDelivery?.country),
    ),
  };

  if (
    !delivery.firstName ||
    !delivery.lastName ||
    !delivery.address ||
    !delivery.city ||
    !delivery.postcode ||
    !delivery.country
  ) {
    throw new Error("Delivery details are incomplete.");
  }

  return delivery;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: unknown;
      tip?: unknown;
      confirmationTokenId?: unknown;
      returnUrlBase?: unknown;
      contact?: unknown;
      delivery?: unknown;
      savePaymentMethod?: unknown;
      savedPaymentMethodId?: unknown;
    };

    const confirmationTokenId = normalizeText(body.confirmationTokenId);
    const savedPaymentMethodId = normalizeText(body.savedPaymentMethodId);
    if (!confirmationTokenId && !savedPaymentMethodId) {
      throw new Error("Payment confirmation could not be initialized.");
    }

    const items = parseItems(body.items);
    const tip = parseQuoteTip(body.tip);
    const returnUrlBase = parseReturnUrlBase(body.returnUrlBase);
    const savePaymentMethod = body.savePaymentMethod === true;
    const stripe = getStripeClient();
    const fallbackContact = parseFallbackContact(body.contact);
    const fallbackDelivery = parseFallbackDelivery(body.delivery);
    const authenticatedUserPromise = getAuthenticatedSupabaseUser(request);
    const confirmationTokenPromise = confirmationTokenId
      ? stripe.confirmationTokens.retrieve(confirmationTokenId)
      : Promise.resolve(null);
    const authenticatedUser = await authenticatedUserPromise;

    if (savedPaymentMethodId && !authenticatedUser) {
      throw new Error("Sign in again to use a saved payment method.");
    }

    const customerProfilePromise = authenticatedUser
      ? ensureCustomerProfileForUser(authenticatedUser, {
          linkOrdersByEmail: false,
          syncMissingProfileFields: false,
        })
      : Promise.resolve(null);
    const confirmationToken = await confirmationTokenPromise;
    const customerProfile = await customerProfilePromise;
    const contact = getContactFromSources(confirmationToken, fallbackContact);
    const delivery = getDeliveryFromSources(confirmationToken, fallbackDelivery);
    const shouldUseSavedPaymentMethod = Boolean(customerProfile && savedPaymentMethodId);

    if (savedPaymentMethodId && !shouldUseSavedPaymentMethod) {
      throw new Error("Saved payment method not found.");
    }

    const stripeCustomerPromise =
      customerProfile && (savePaymentMethod || shouldUseSavedPaymentMethod)
        ? ensureStripeCustomerForProfile(customerProfile)
        : Promise.resolve("");
    const draftPromise = createPendingStripeOrder({
      items,
      contact,
      delivery,
      tip,
      customer: customerProfile
        ? {
            supabaseUserId: customerProfile.supabaseUserId,
            customerProfileId: customerProfile.id,
          }
        : undefined,
    });
    const [stripeCustomerId, draft] = await Promise.all([stripeCustomerPromise, draftPromise]);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: draft.totalCents,
      automatic_payment_methods: {
        enabled: shouldUseSavedPaymentMethod ? false : true,
      },
      confirm: true,
      confirmation_token: shouldUseSavedPaymentMethod ? undefined : confirmationTokenId,
      customer: stripeCustomerId || undefined,
      currency: STRIPE_CHECKOUT_COSTS.currency,
      description: `Order ${draft.orderPublicId}`,
      metadata: {
        orderId: draft.orderPublicId,
        source: "grown-cookies",
      },
      payment_method: shouldUseSavedPaymentMethod ? savedPaymentMethodId : undefined,
      payment_method_types: shouldUseSavedPaymentMethod ? ["card"] : undefined,
      return_url: `${returnUrlBase}/checkout/success?orderId=${draft.orderPublicId}`,
      setup_future_usage: savePaymentMethod && stripeCustomerId ? "off_session" : undefined,
    });

    if (!paymentIntent.client_secret || !paymentIntent.id) {
      return NextResponse.json({ error: "Could not finalize payment." }, { status: 500 });
    }

    await setOrderPaymentIntentId(draft.orderPublicId, paymentIntent.id);

    return NextResponse.json({
      orderId: draft.orderPublicId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not finalize payment." }, { status: 400 });
  }
}
