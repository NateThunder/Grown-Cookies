import { NextResponse } from "next/server";
import {
  buildCheckoutQuote,
  parseQuoteGiftCardCodes,
  parseQuoteItems,
  parseQuoteTip,
} from "@/lib/checkout-quote";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import { consumeCheckoutAttempt } from "@/lib/checkout-attempt-throttle";
import { ensureCustomerProfileForUser } from "@/lib/customer-profiles";
import { parseDispatchSelection } from "@/lib/dispatch";
import {
  STRIPE_CHECKOUT_ORDER_STATUS,
  createPendingStripeOrder,
  type StripeCheckoutContactInput,
  type StripeCheckoutDeliveryInput,
} from "@/lib/stripe-checkout";
import { ensurePaidOrderEmails } from "@/lib/order-notifications";

export const runtime = "nodejs";

const SUPPORTED_COUNTRIES = {
  GB: "United Kingdom",
} as const;

type CheckoutContactPayload = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
};

type CheckoutDeliveryPayload = {
  fullName: string;
  address: string;
  flatNumber: string;
  city: string;
  postcode: string;
  country: string;
} | null;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function splitFullName(fullName: string) {
  const normalized = normalizeText(fullName);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || parts[0] || "",
  };
}

function buildFullName(firstName: string, lastName: string) {
  return [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(" ");
}

function parseCheckoutContact(raw: unknown): CheckoutContactPayload {
  if (!raw || typeof raw !== "object") {
    return { email: "", phone: "", firstName: "", lastName: "" };
  }

  return {
    email: normalizeText((raw as { email?: unknown }).email),
    phone: normalizeText((raw as { phone?: unknown }).phone),
    firstName: normalizeText((raw as { firstName?: unknown }).firstName),
    lastName: normalizeText((raw as { lastName?: unknown }).lastName),
  };
}

function parseCheckoutDelivery(raw: unknown): CheckoutDeliveryPayload {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const delivery = {
    fullName:
      normalizeText((raw as { fullName?: unknown }).fullName) ||
      buildFullName(
        normalizeText((raw as { firstName?: unknown }).firstName),
        normalizeText((raw as { lastName?: unknown }).lastName),
      ),
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
    throw new Error("We only deliver to the United Kingdom.");
  }

  return country;
}

function getContactFromSource(contact: CheckoutContactPayload): StripeCheckoutContactInput {
  const email = normalizeText(contact.email);
  if (!email) {
    throw new Error("Email is required.");
  }

  return {
    email,
    phone: normalizeText(contact.phone),
    firstName: normalizeText(contact.firstName),
    lastName: normalizeText(contact.lastName),
  };
}

function getDeliveryFromSource(
  fallbackDelivery: CheckoutDeliveryPayload,
  options: { requiresDelivery?: boolean } = {},
): StripeCheckoutDeliveryInput {
  const requiresDelivery = options.requiresDelivery !== false;
  const rawFullName = normalizeText(fallbackDelivery?.fullName);
  const { firstName, lastName } = splitFullName(rawFullName);
  const rawCountry = normalizeText(fallbackDelivery?.country);
  const delivery = {
    firstName,
    lastName,
    address: normalizeText(fallbackDelivery?.address),
    flatNumber: normalizeText(fallbackDelivery?.flatNumber),
    city: normalizeText(fallbackDelivery?.city),
    postcode: normalizeText(fallbackDelivery?.postcode),
    country: rawCountry ? requireSupportedCountry(rawCountry) : "",
  };

  if (!requiresDelivery) {
    return delivery;
  }

  if (
    !rawFullName ||
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
      contact?: unknown;
      delivery?: unknown;
      dispatch?: unknown;
      fulfilment?: unknown;
      giftCardCodes?: unknown;
      orderJourney?: unknown;
    };

    const items = parseQuoteItems(body.items);
    const tip = parseQuoteTip(body.tip);
    const giftCardCodes = parseQuoteGiftCardCodes(body.giftCardCodes);
    const dispatch = parseDispatchSelection(body.fulfilment ?? body.dispatch);
    const quote = await buildCheckoutQuote({ items, tip, dispatch, giftCardCodes });

    if (quote.giftCardAppliedCents <= 0 || quote.stripeAmountCents > 0) {
      throw new Error("A card payment is still due for this order.");
    }

    const requiresDelivery = quote.lines.some((line) => !line.isGiftCard) && quote.fulfilmentMethod === "uk_postal_shipping";
    const contact = getContactFromSource(parseCheckoutContact(body.contact));
    const delivery = getDeliveryFromSource(parseCheckoutDelivery(body.delivery), {
      requiresDelivery,
    });
    const authenticatedUser = await getAuthenticatedSupabaseUser(request);

    await consumeCheckoutAttempt({
      request,
      email: contact.email,
      delivery,
      items,
    });

    const customerProfile = authenticatedUser
      ? await ensureCustomerProfileForUser(authenticatedUser, {
          linkOrdersByEmail: false,
          syncMissingProfileFields: false,
        })
      : null;

    const draft = await createPendingStripeOrder({
      items,
      contact,
      delivery,
      tip,
      dispatch,
      giftCardCodes,
      orderJourney: body.orderJourney,
      initialStatus: STRIPE_CHECKOUT_ORDER_STATUS.paid,
      customer: customerProfile
        ? {
            supabaseUserId: customerProfile.supabaseUserId,
            customerProfileId: customerProfile.id,
          }
        : undefined,
    });

    await ensurePaidOrderEmails(draft.orderPublicId);

    return NextResponse.json({
      orderId: draft.orderPublicId,
      status: STRIPE_CHECKOUT_ORDER_STATUS.paid,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not place this order.",
      },
      { status: 400 },
    );
  }
}
