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
import { parseDispatchSelection } from "@/lib/dispatch";

export const runtime = "nodejs";

const SUPPORTED_COUNTRIES = {
  GB: "United Kingdom",
} as const;

const DEFAULT_CHECKOUT_RETURN_ORIGINS = [
  "https://growncookies.co.uk",
  "https://www.growncookies.co.uk",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
] as const;
const CHECKOUT_PAYMENT_METHOD_TYPES = ["card", "link", "revolut_pay", "klarna", "amazon_pay"] as const;

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

function getCheckoutAttemptId(request: Request) {
  return normalizeText(request.headers.get("x-checkout-attempt-id")) || `server_${Date.now()}`;
}

function logCheckoutServerEvent(
  attemptId: string,
  step: string,
  message: string,
  details?: Record<string, unknown>,
  level: "info" | "error" = "info",
) {
  const prefix = `[checkout:${attemptId}] ${step} ${message}`;
  const logger = level === "error" ? console.error : console.info;

  if (details) {
    logger(prefix, details);
    return;
  }

  logger(prefix);
}

async function withCheckoutServerTiming<T>(
  attemptId: string,
  step: string,
  action: () => Promise<T>,
  details?: Record<string, unknown>,
): Promise<T> {
  const startedAt = Date.now();
  logCheckoutServerEvent(attemptId, step, "started", details);

  try {
    const result = await action();
    logCheckoutServerEvent(attemptId, step, "completed", {
      ...(details ?? {}),
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    logCheckoutServerEvent(
      attemptId,
      step,
      "failed",
      {
        ...(details ?? {}),
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "error",
    );
    throw error;
  }
}

function parseItems(raw: unknown) {
  return parseQuoteItems(raw);
}

function normalizeCheckoutReturnOrigin(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function parseCheckoutReturnOrigins(value: unknown) {
  return normalizeText(value)
    .split(",")
    .map((origin) => normalizeCheckoutReturnOrigin(origin))
    .filter(Boolean);
}

function getCheckoutReturnOriginAllowlist() {
  return new Set([
    ...DEFAULT_CHECKOUT_RETURN_ORIGINS,
    ...parseCheckoutReturnOrigins(process.env.NEXT_PUBLIC_SITE_URL),
    ...parseCheckoutReturnOrigins(process.env.CHECKOUT_RETURN_ALLOWED_ORIGINS),
  ]);
}

function getRequestOrigin(request: Request) {
  const requestOrigin = normalizeCheckoutReturnOrigin(request.url);
  if (!requestOrigin) {
    throw new Error("Return URL is invalid.");
  }

  return requestOrigin;
}

function getCheckoutReturnOrigin(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  if (!getCheckoutReturnOriginAllowlist().has(requestOrigin)) {
    throw new Error("Checkout return URL origin is not allowed.");
  }

  return requestOrigin;
}

function buildCheckoutSuccessReturnUrl(returnUrlBase: string, orderPublicId: string) {
  const returnUrl = new URL("/checkout/success", returnUrlBase);
  returnUrl.searchParams.set("orderId", orderPublicId);
  return returnUrl.toString();
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

function buildFullName(firstName: string, lastName: string) {
  return [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(" ");
}

function requireSupportedCountry(raw: string) {
  const country = normalizeSupportedCountry(raw);
  if (!country) {
    throw new Error("We only deliver to the United Kingdom.");
  }

  return country;
}

function getContactFromSources(
  paymentContact: CheckoutContactPayload,
  fallbackContact: CheckoutContactPayload,
): StripeCheckoutContactInput {
  const email = normalizeText(paymentContact.email) || normalizeText(fallbackContact.email);
  if (!email) {
    throw new Error("Email is required.");
  }

  return {
    email,
    phone: normalizeText(paymentContact.phone) || normalizeText(fallbackContact.phone),
    firstName: normalizeText(paymentContact.firstName) || normalizeText(fallbackContact.firstName),
    lastName: normalizeText(paymentContact.lastName) || normalizeText(fallbackContact.lastName),
  };
}

function getDeliveryFromSources(
  paymentDelivery: CheckoutDeliveryPayload,
  fallbackDelivery: CheckoutDeliveryPayload,
  options: { requiresDelivery?: boolean } = {},
): StripeCheckoutDeliveryInput {
  const requiresDelivery = options.requiresDelivery !== false;
  const rawCountry =
    normalizeText(paymentDelivery?.country) || normalizeText(fallbackDelivery?.country);
  const rawFullName = normalizeText(paymentDelivery?.fullName) || normalizeText(fallbackDelivery?.fullName);
  const { firstName, lastName } = splitFullName(rawFullName);
  const delivery = {
    firstName,
    lastName,
    address: normalizeText(paymentDelivery?.address) || normalizeText(fallbackDelivery?.address),
    flatNumber:
      normalizeText(paymentDelivery?.flatNumber) || normalizeText(fallbackDelivery?.flatNumber),
    city: normalizeText(paymentDelivery?.city) || normalizeText(fallbackDelivery?.city),
    postcode: normalizeText(paymentDelivery?.postcode) || normalizeText(fallbackDelivery?.postcode),
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
  const requestStartedAt = Date.now();
  const attemptId = getCheckoutAttemptId(request);

  try {
    logCheckoutServerEvent(attemptId, "confirm-payment.request", "received");

    const body = (await request.json()) as {
      items?: unknown;
      tip?: unknown;
      confirmationTokenId?: unknown;
      contact?: unknown;
      delivery?: unknown;
      paymentContact?: unknown;
      paymentDelivery?: unknown;
      dispatch?: unknown;
      fulfilment?: unknown;
      giftCardCodes?: unknown;
      savePaymentMethod?: unknown;
      savedPaymentMethodId?: unknown;
      orderJourney?: unknown;
    };

    const confirmationTokenId = normalizeText(body.confirmationTokenId);
    const savedPaymentMethodId = normalizeText(body.savedPaymentMethodId);
    if (!confirmationTokenId && !savedPaymentMethodId) {
      throw new Error("Payment confirmation could not be initialized.");
    }

    const items = parseItems(body.items);
    const tip = parseQuoteTip(body.tip);
    const giftCardCodes = parseQuoteGiftCardCodes(body.giftCardCodes);
    const dispatch = parseDispatchSelection(body.fulfilment ?? body.dispatch);
    const quote = await buildCheckoutQuote({ items, tip, dispatch, giftCardCodes });
    const requiresDelivery = quote.lines.some((line) => !line.isGiftCard) && quote.fulfilmentMethod === "uk_postal_shipping";
    if (quote.stripeAmountCents <= 0) {
      throw new Error("No card payment is due. Place this order with your gift card balance.");
    }
    const returnUrlBase = getCheckoutReturnOrigin(request);
    const savePaymentMethod = body.savePaymentMethod === true;
    const stripe = getStripeClient();
    const fallbackContact = parseCheckoutContact(body.contact);
    const fallbackDelivery = parseCheckoutDelivery(body.delivery);
    const paymentContact = parseCheckoutContact(body.paymentContact);
    const paymentDelivery = parseCheckoutDelivery(body.paymentDelivery);
    const authenticatedUserPromise = getAuthenticatedSupabaseUser(request);
    const contact = getContactFromSources(paymentContact, fallbackContact);
    const delivery = getDeliveryFromSources(paymentDelivery, fallbackDelivery, {
      requiresDelivery,
    });

    logCheckoutServerEvent(attemptId, "confirm-payment.details", "resolved", {
      hasConfirmationToken: Boolean(confirmationTokenId),
      hasPaymentContact: Boolean(paymentContact.email || paymentContact.phone),
      hasPaymentDelivery: Boolean(paymentDelivery),
      requiresDelivery,
      usingSavedPaymentMethod: Boolean(savedPaymentMethodId),
    });

    await withCheckoutServerTiming(
      attemptId,
      "consumeCheckoutAttempt",
      () =>
        consumeCheckoutAttempt({
          request,
          email: contact.email,
          delivery,
          items,
        }),
      {
        email: contact.email,
        itemCount: items.length,
      },
    );

    const authenticatedUser = await withCheckoutServerTiming(
      attemptId,
      "getAuthenticatedSupabaseUser",
      () => authenticatedUserPromise,
      {
        requiresAuthenticatedCustomer: Boolean(savePaymentMethod || savedPaymentMethodId),
      },
    );

    if (savedPaymentMethodId && !authenticatedUser) {
      throw new Error("Sign in again to use a saved payment method.");
    }

    if (savePaymentMethod && !authenticatedUser) {
      throw new Error("Sign in again to save this card.");
    }

    const customerProfile = authenticatedUser
      ? await withCheckoutServerTiming(
          attemptId,
          "ensureCustomerProfileForUser",
          () =>
            ensureCustomerProfileForUser(authenticatedUser, {
              linkOrdersByEmail: false,
              syncMissingProfileFields: false,
            }),
          {
            userId: authenticatedUser.id,
          },
        )
      : null;
    const shouldUseSavedPaymentMethod = Boolean(customerProfile && savedPaymentMethodId);

    if (savedPaymentMethodId && !shouldUseSavedPaymentMethod) {
      throw new Error("Saved payment method not found.");
    }

    const stripeCustomerPromise =
      customerProfile && (savePaymentMethod || shouldUseSavedPaymentMethod)
        ? withCheckoutServerTiming(
            attemptId,
            "ensureStripeCustomerForProfile",
            () => ensureStripeCustomerForProfile(customerProfile),
            {
              customerProfileId: customerProfile.id,
            },
          )
        : Promise.resolve("");
    const draftPromise = withCheckoutServerTiming(
      attemptId,
      "createPendingStripeOrder",
      () =>
        createPendingStripeOrder({
          items,
          contact,
          delivery,
          tip,
          dispatch,
          giftCardCodes,
          orderJourney: body.orderJourney,
          customer: customerProfile
            ? {
                supabaseUserId: customerProfile.supabaseUserId,
                customerProfileId: customerProfile.id,
              }
            : undefined,
        }),
      {
        email: contact.email,
        itemCount: items.length,
      },
    );
    const [stripeCustomerId, draft] = await Promise.all([stripeCustomerPromise, draftPromise]);

    const paymentIntent = await withCheckoutServerTiming(
      attemptId,
      "stripe.paymentIntents.create",
      () =>
        stripe.paymentIntents.create({
          amount: draft.stripeAmountCents,
          automatic_payment_methods: shouldUseSavedPaymentMethod
            ? {
                enabled: false,
              }
            : undefined,
          confirm: true,
          confirmation_token: shouldUseSavedPaymentMethod ? undefined : confirmationTokenId,
          customer: stripeCustomerId || undefined,
          currency: STRIPE_CHECKOUT_COSTS.currency,
          description: `Order ${draft.orderPublicId}`,
          metadata: {
            orderId: draft.orderPublicId,
            source: "grown-cookies",
          },
          // ConfirmationToken integrations require per-method future-use settings.
          payment_method_options:
            savePaymentMethod && stripeCustomerId && !shouldUseSavedPaymentMethod
              ? {
                  card: {
                    setup_future_usage: "off_session",
                  },
                }
              : undefined,
          payment_method: shouldUseSavedPaymentMethod ? savedPaymentMethodId : undefined,
          payment_method_types: shouldUseSavedPaymentMethod ? ["card"] : [...CHECKOUT_PAYMENT_METHOD_TYPES],
          return_url: buildCheckoutSuccessReturnUrl(returnUrlBase, draft.orderPublicId),
        }),
      {
        amount: draft.stripeAmountCents,
        orderId: draft.orderPublicId,
        savePaymentMethod,
        usingSavedPaymentMethod: shouldUseSavedPaymentMethod,
      },
    );

    if (!paymentIntent.client_secret || !paymentIntent.id) {
      return NextResponse.json({ error: "Could not finalize payment." }, { status: 500 });
    }

    await withCheckoutServerTiming(
      attemptId,
      "setOrderPaymentIntentId",
      () => setOrderPaymentIntentId(draft.orderPublicId, paymentIntent.id),
      {
        orderId: draft.orderPublicId,
        paymentIntentId: paymentIntent.id,
      },
    );

    logCheckoutServerEvent(attemptId, "confirm-payment.request", "completed", {
      durationMs: Date.now() - requestStartedAt,
      orderId: draft.orderPublicId,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    return NextResponse.json({
      orderId: draft.orderPublicId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (error) {
    logCheckoutServerEvent(
      attemptId,
      "confirm-payment.request",
      "failed",
      {
        durationMs: Date.now() - requestStartedAt,
        error: error instanceof Error ? error.message : "Could not finalize payment.",
      },
      "error",
    );

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not finalize payment." }, { status: 400 });
  }
}
