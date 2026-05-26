"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiLock, FiMinus, FiPlus, FiSearch } from "react-icons/fi";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  type Stripe,
  type StripeElementsOptions,
  type StripeExpressCheckoutElementConfirmEvent,
  type StripePaymentElementOptions,
  loadStripe,
} from "@stripe/stripe-js";
import { BASKET_UPDATED_EVENT, getBasket } from "@/lib/basket-storage";
import { DISPATCH_UPDATED_EVENT, getDispatchSelection } from "@/lib/dispatch-storage";
import {
  TIP_PRESET_OPTIONS,
  formatPriceFromCents,
  parseMoneyTextToCents,
  type BasketQuote,
  type BasketStoredItem,
  type BasketTipInput,
} from "@/lib/basket";
import {
  UK_POSTAL_SHIPPING_LABEL,
  formatDispatchDate,
  type DispatchSelection,
} from "@/lib/dispatch";
import { formatGiftCardAmount } from "@/lib/gift-card-amounts";
import GiftCardTile from "@/components/gift-card-tile";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer-profiles";
import type { SavedPaymentMethod } from "@/lib/saved-payment-methods";
import { publicStripeAppearance } from "@/lib/stripe-appearance";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "@/components/checkout-client.module.css";

type ContactDetails = {
  email: string;
  phone: string;
};

type DeliveryDetails = {
  fullName: string;
  address: string;
  flatNumber: string;
  city: string;
  postcode: string;
  country: string;
};

type ConfirmPaymentPayload = {
  confirmationTokenId?: string;
  savedPaymentMethodId?: string;
  savePaymentMethod?: boolean;
  items: BasketStoredItem[];
  tip: BasketTipInput;
  giftCardCodes: string[];
  contact?: ContactDetails;
  delivery?: DeliveryDetails;
  dispatch?: DispatchSelection | null;
  paymentContact?: ContactDetails;
  paymentDelivery?: DeliveryDetails;
};

type ConfirmPaymentResponse = {
  orderId?: string;
  paymentIntentId?: string;
  clientSecret?: string;
  status?: string;
};

type CheckoutAccountResponse = {
  profile?: CustomerProfile;
  addresses?: CustomerAddress[];
  paymentMethods?: SavedPaymentMethod[];
  error?: string;
};

type AddressSuggestion = {
  label: string;
  secondaryLabel: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
};

const SUPPORTED_COUNTRIES = [
  { code: "GB", label: "United Kingdom" },
] as const;

const defaultDelivery = {
  fullName: "",
  address: "",
  flatNumber: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
};

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const STRIPE_PREPARE_TIMEOUT_MS = 20_000;
const PAYMENT_CONFIRM_SLOW_NOTICE_MS = 25_000;
const PAYMENT_CONFIRM_ABORT_MS = 60_000;
const CHECKOUT_GIFT_CARD_STORAGE_KEY = "grown-cookies-checkout-gift-cards";
const CHECKOUT_TIPS_ENABLED = false;
const CHECKOUT_PAYMENT_METHOD_TYPES = ["card", "link", "revolut_pay", "klarna", "amazon_pay"] as const;
const PAYMENT_ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: "tabs",
  paymentMethodOrder: [...CHECKOUT_PAYMENT_METHOD_TYPES],
};
type CheckoutFlow = "manual_card" | "express" | "saved_card";

function stripeErrorText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function normalizeText(value: string) {
  return value.trim();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function createCheckoutAttemptId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  return `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function logCheckoutClientEvent(
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

async function withCheckoutClientTiming<T>(
  attemptId: string,
  step: string,
  action: () => Promise<T>,
  details?: Record<string, unknown>,
): Promise<T> {
  const startedAt = performance.now();
  logCheckoutClientEvent(attemptId, step, "started", details);

  try {
    const result = await action();
    logCheckoutClientEvent(attemptId, step, "completed", {
      ...(details ?? {}),
      durationMs: Math.round(performance.now() - startedAt),
    });
    return result;
  } catch (error) {
    logCheckoutClientEvent(
      attemptId,
      step,
      "failed",
      {
        ...(details ?? {}),
        durationMs: Math.round(performance.now() - startedAt),
        error: stripeErrorText(error),
      },
      "error",
    );
    throw error;
  }
}

function getCountryCodeFromLabel(label: string) {
  const normalized = normalizeText(label);
  const match = SUPPORTED_COUNTRIES.find((country) => country.label === normalized);
  return match?.code ?? null;
}

function getCountryLabel(raw: string) {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return "";
  }

  const codeMatch = SUPPORTED_COUNTRIES.find((country) => country.code === normalized.toUpperCase());
  if (codeMatch) {
    return codeMatch.label;
  }

  const labelMatch = SUPPORTED_COUNTRIES.find(
    (country) => country.label.toLowerCase() === normalized.toLowerCase(),
  );
  return labelMatch?.label ?? "";
}

function isSupportedCountryCode(code: string) {
  const normalized = normalizeText(code).toUpperCase();
  return SUPPORTED_COUNTRIES.some((country) => country.code === normalized);
}

function buildFullName(firstName: string, lastName: string) {
  return [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(" ");
}

function buildCheckoutContactPayload(contact: ContactDetails): ContactDetails {
  return {
    email: normalizeText(contact.email),
    phone: normalizeText(contact.phone),
  };
}

function buildCheckoutDeliveryPayload(delivery: DeliveryDetails): DeliveryDetails {
  return {
    fullName: normalizeText(delivery.fullName),
    address: normalizeText(delivery.address),
    flatNumber: normalizeText(delivery.flatNumber),
    city: normalizeText(delivery.city),
    postcode: normalizeText(delivery.postcode),
    country: getCountryLabel(delivery.country) || normalizeText(delivery.country),
  };
}

function buildExpressContactPayload(
  event: StripeExpressCheckoutElementConfirmEvent,
  fallbackContact: ContactDetails,
): ContactDetails {
  return {
    email: normalizeText(event.billingDetails?.email ?? "") || normalizeText(fallbackContact.email),
    phone: normalizeText(event.billingDetails?.phone ?? "") || normalizeText(fallbackContact.phone),
  };
}

function buildExpressDeliveryPayload(
  event: StripeExpressCheckoutElementConfirmEvent,
  fallbackDelivery: DeliveryDetails,
): DeliveryDetails | undefined {
  if (!event.shippingAddress) {
    return undefined;
  }

  return {
    fullName: normalizeText(event.shippingAddress.name) || normalizeText(fallbackDelivery.fullName),
    address: normalizeText(event.shippingAddress.address.line1) || normalizeText(fallbackDelivery.address),
    flatNumber:
      normalizeText(event.shippingAddress.address.line2 ?? "") ||
      normalizeText(fallbackDelivery.flatNumber),
    city: normalizeText(event.shippingAddress.address.city) || normalizeText(fallbackDelivery.city),
    postcode:
      normalizeText(event.shippingAddress.address.postal_code) ||
      normalizeText(fallbackDelivery.postcode),
    country:
      getCountryLabel(event.shippingAddress.address.country) ||
      getCountryLabel(fallbackDelivery.country) ||
      normalizeText(fallbackDelivery.country),
  };
}

function buildRedirectUrl(params: {
  orderId: string;
  paymentIntentId: string;
  clientSecret?: string;
}) {
  const searchParams = new URLSearchParams({
    orderId: params.orderId,
    payment_intent: params.paymentIntentId,
  });

  if (params.clientSecret) {
    searchParams.set("payment_intent_client_secret", params.clientSecret);
  }

  return `/checkout/success?${searchParams.toString()}`;
}

function getStoredCheckoutGiftCardCodes() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(CHECKOUT_GIFT_CARD_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

type FinalizeCheckoutPaymentParams = {
  stripe: Stripe | null;
  items: BasketStoredItem[];
  tip: BasketTipInput;
  giftCardCodes: string[];
  contact: ContactDetails;
  delivery: DeliveryDetails;
  dispatch: DispatchSelection | null;
  authAccessToken: string;
  setPaymentProgressMessage: (message: string) => void;
  attemptId: string;
  confirmationTokenId?: string;
  flow: CheckoutFlow;
  savedPaymentMethodId?: string;
  savePaymentMethod?: boolean;
  paymentContact?: ContactDetails;
  paymentDelivery?: DeliveryDetails;
};

function redirectToCheckoutSuccess(params: {
  orderId: string;
  paymentIntentId: string;
  clientSecret?: string;
}) {
  window.location.href = buildRedirectUrl(params);
}

async function finalizeCheckoutPayment(params: FinalizeCheckoutPaymentParams) {
  const shouldSendAuthToken = Boolean(
    params.authAccessToken && (params.savePaymentMethod || params.savedPaymentMethodId),
  );
  let response: Response;
  const abortController = new AbortController();
  const slowNoticeTimeoutId = window.setTimeout(() => {
    params.setPaymentProgressMessage(
      "Payment confirmation is taking longer than usual. Please keep this page open while we finish confirming it.",
    );
  }, PAYMENT_CONFIRM_SLOW_NOTICE_MS);
  const requestTimeoutId = window.setTimeout(() => {
    abortController.abort();
  }, PAYMENT_CONFIRM_ABORT_MS);

  try {
    response = await withCheckoutClientTiming(
      params.attemptId,
      "confirm-payment.request",
      () =>
        fetch("/api/stripe/confirm-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Checkout-Attempt-Id": params.attemptId,
            ...(shouldSendAuthToken ? { Authorization: `Bearer ${params.authAccessToken}` } : {}),
          },
          body: JSON.stringify({
            confirmationTokenId: params.confirmationTokenId,
            savedPaymentMethodId: params.savedPaymentMethodId,
            savePaymentMethod: params.savePaymentMethod,
            items: params.items,
            tip: params.tip,
            giftCardCodes: params.giftCardCodes,
            contact: params.contact,
            delivery: params.delivery,
            dispatch: params.dispatch,
            paymentContact: params.paymentContact,
            paymentDelivery: params.paymentDelivery,
          } satisfies ConfirmPaymentPayload),
          signal: abortController.signal,
        }),
      {
        flow: params.flow,
        itemCount: params.items.length,
        savePaymentMethod: Boolean(params.savePaymentMethod),
        usingSavedPaymentMethod: Boolean(params.savedPaymentMethodId),
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Payment confirmation did not return within one minute. If your bank or wallet is still asking for approval, finish that first, then wait a moment before trying again.",
        { cause: error },
      );
    }

    throw error;
  } finally {
    window.clearTimeout(slowNoticeTimeoutId);
    window.clearTimeout(requestTimeoutId);
    params.setPaymentProgressMessage("");
  }

  const result = await withCheckoutClientTiming(
    params.attemptId,
    "confirm-payment.response",
    async () => {
      const payload = (await response.json().catch(() => ({}))) as ConfirmPaymentResponse & {
        error?: string;
      };
      return payload;
    },
    {
      flow: params.flow,
      ok: response.ok,
      status: response.status,
    },
  );

  if (!response.ok) {
    throw new Error(result.error || "Could not finalize payment.");
  }

  if (!result.orderId || !result.paymentIntentId || !result.clientSecret || !result.status) {
    throw new Error("Could not finalize payment.");
  }

  const orderId = result.orderId;
  const paymentIntentId = result.paymentIntentId;
  const clientSecret = result.clientSecret;
  const status = result.status;

  if (status === "requires_action") {
    const stripe = params.stripe;
    if (!stripe) {
      throw new Error("Payment form is still loading. Please wait.");
    }

    const nextActionResult = await withCheckoutClientTiming(
      params.attemptId,
      "stripe.handleNextAction",
      () =>
        stripe.handleNextAction({
          clientSecret,
        }),
      {
        flow: params.flow,
        orderId,
        paymentIntentId,
      },
    );

    if (nextActionResult.error) {
      throw new Error(stripeErrorText(nextActionResult.error));
    }

    if (nextActionResult.paymentIntent?.id) {
      logCheckoutClientEvent(params.attemptId, "checkout.redirect", "redirecting after next action", {
        flow: params.flow,
        orderId,
        paymentIntentId: nextActionResult.paymentIntent.id,
        status,
      });
      redirectToCheckoutSuccess({
        orderId,
        paymentIntentId: nextActionResult.paymentIntent.id,
        clientSecret,
      });
    }

    return;
  }

  if (
    status === "succeeded" ||
    status === "processing" ||
    status === "requires_capture"
  ) {
    logCheckoutClientEvent(params.attemptId, "checkout.redirect", "redirecting after confirmation", {
      flow: params.flow,
      orderId,
      paymentIntentId,
      status,
    });
    redirectToCheckoutSuccess({
      orderId,
      paymentIntentId,
      clientSecret,
    });
    return;
  }

  throw new Error("Payment could not be completed. Please try another payment method.");
}

function validateManualCheckoutDetails(
  contact: ContactDetails,
  delivery: DeliveryDetails,
  dispatch: DispatchSelection | null,
  requiresDelivery: boolean,
) {
  if (!normalizeText(contact.email)) {
    return "Enter a contact email address.";
  }

  if (!requiresDelivery) {
    return "";
  }

  const requiredDeliveryValues = [
    delivery.fullName,
    delivery.address,
    delivery.city,
    delivery.postcode,
    delivery.country,
  ];

  if (requiredDeliveryValues.some((value) => !normalizeText(value))) {
    return "Enter complete delivery details.";
  }

  if (!getCountryCodeFromLabel(delivery.country)) {
    return "We only deliver to the United Kingdom.";
  }

  if (!dispatch?.dispatchDate) {
    return "Choose a dispatch date from your basket before checkout.";
  }

  return "";
}

function buildAddress(address: {
  line1: string;
  line2?: string | null;
  city: string;
  postalCode: string;
  country: string;
  state?: string;
}) {
  return {
    line1: normalizeText(address.line1),
    line2: normalizeText(address.line2 ?? "") || null,
    city: normalizeText(address.city),
    postal_code: normalizeText(address.postalCode),
    country: normalizeText(address.country),
    state: normalizeText(address.state ?? "") || null,
  };
}

function buildManualShipping(delivery: DeliveryDetails, phone: string) {
  const countryCode = getCountryCodeFromLabel(delivery.country);
  if (!countryCode) {
    return undefined;
  }

  return {
    name: normalizeText(delivery.fullName),
    phone: normalizeText(phone) || undefined,
    address: buildAddress({
      line1: delivery.address,
      line2: delivery.flatNumber,
      city: delivery.city,
      postalCode: delivery.postcode,
      country: countryCode,
    }),
  };
}

function buildManualBillingDetails(contact: ContactDetails, delivery: DeliveryDetails) {
  const shipping = buildManualShipping(delivery, contact.phone);
  const billingDetails = {
    name: normalizeText(delivery.fullName) || undefined,
    email: normalizeText(contact.email) || undefined,
    phone: normalizeText(contact.phone) || undefined,
    address: shipping?.address,
  };

  if (!billingDetails.name && !billingDetails.email && !billingDetails.phone && !billingDetails.address) {
    return undefined;
  }

  return billingDetails;
}

function buildDigitalBillingDetails(contact: ContactDetails) {
  const billingDetails = {
    email: normalizeText(contact.email) || undefined,
    phone: normalizeText(contact.phone) || undefined,
  };

  if (!billingDetails.email && !billingDetails.phone) {
    return undefined;
  }

  return billingDetails;
}

function buildExpressBillingDetails(
  event: StripeExpressCheckoutElementConfirmEvent,
  contact: ContactDetails,
  delivery: DeliveryDetails,
) {
  const billingAddress = event.billingDetails?.address
    ? buildAddress({
        line1: event.billingDetails.address.line1,
        line2: event.billingDetails.address.line2,
        city: event.billingDetails.address.city,
        postalCode: event.billingDetails.address.postal_code,
        country: event.billingDetails.address.country,
        state: event.billingDetails.address.state,
      })
    : undefined;

  const fallbackName = normalizeText(delivery.fullName);
  const billingDetails = {
    name: normalizeText(event.billingDetails?.name ?? "") || event.shippingAddress?.name || fallbackName || undefined,
    email: normalizeText(event.billingDetails?.email ?? "") || normalizeText(contact.email) || undefined,
    phone: normalizeText(event.billingDetails?.phone ?? "") || normalizeText(contact.phone) || undefined,
    address: billingAddress,
  };

  if (!billingDetails.name && !billingDetails.email && !billingDetails.phone && !billingDetails.address) {
    return undefined;
  }

  return billingDetails;
}

function buildExpressShipping(
  event: StripeExpressCheckoutElementConfirmEvent,
  contact: ContactDetails,
) {
  if (!event.shippingAddress) {
    return undefined;
  }

  return {
    name: normalizeText(event.shippingAddress.name),
    phone: normalizeText(event.billingDetails?.phone ?? "") || normalizeText(contact.phone) || undefined,
    address: buildAddress({
      line1: event.shippingAddress.address.line1,
      line2: event.shippingAddress.address.line2,
      city: event.shippingAddress.address.city,
      postalCode: event.shippingAddress.address.postal_code,
      country: event.shippingAddress.address.country,
      state: event.shippingAddress.address.state,
    }),
  };
}

function buildExpressLineItems(quote: BasketQuote) {
  const lineItems = quote.lines.map((line) => ({
    name: line.isGiftCard
      ? `${line.name} ${formatGiftCardAmount(line.unitPriceCents)}`
      : line.quantity > 1
        ? `${line.name} x${line.quantity}`
        : line.name,
    amount: line.lineTotalCents,
  }));

  if (quote.tipCents > 0) {
    lineItems.push({
      name: "Tip",
      amount: quote.tipCents,
    });
  }

  if (quote.shippingCents > 0) {
    lineItems.push({
      name: UK_POSTAL_SHIPPING_LABEL,
      amount: quote.shippingCents,
    });
  }

  if (quote.giftCardAppliedCents > 0) {
    lineItems.push({
      name: "Gift cards",
      amount: -quote.giftCardAppliedCents,
    });
  }

  return lineItems;
}

function buildExpressShippingRates(shippingCents: number) {
  if (shippingCents <= 0) {
    return [];
  }

  return [
    {
      id: "uk-postal-shipping",
      amount: shippingCents,
      displayName: UK_POSTAL_SHIPPING_LABEL,
    },
  ];
}

function getExpressFailureReason(message: string) {
  const normalized = normalizeText(message).toLowerCase();

  if (normalized.includes("country")) {
    return "address_unserviceable" as const;
  }

  if (normalized.includes("delivery") || normalized.includes("shipping")) {
    return "invalid_shipping_address" as const;
  }

  if (normalized.includes("billing")) {
    return "invalid_billing_address" as const;
  }

  if (normalized.includes("payment")) {
    return "invalid_payment_data" as const;
  }

  return "fail" as const;
}

function formatCardBrand(brand: string) {
  return brand
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSavedAddressLabel(address: CustomerAddress) {
  return address.label || (address.isDefault ? "Default address" : "Saved address");
}

function mapProfileToContact(profile: CustomerProfile) {
  return {
    email: profile.email,
    phone: profile.phone,
  };
}

function mapAddressToDelivery(address: CustomerAddress): DeliveryDetails {
  return {
    fullName: buildFullName(address.firstName, address.lastName),
    address: address.addressLine1,
    flatNumber: address.addressLine2,
    city: address.city,
    postcode: address.postcode,
    country: address.country || defaultDelivery.country,
  };
}

function CheckoutElementsShell({
  children,
  options,
}: {
  children: ReactNode;
  options: StripeElementsOptions | null;
}) {
  if (!options || !stripePromise) {
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}

function ExpressCheckoutSection({
  items,
  tip,
  giftCardCodes,
  contact,
  delivery,
  dispatch,
  authAccessToken,
  isAuthenticated,
  selectedSavedPaymentMethodId,
  savePaymentMethod,
  quote,
  isDigitalOnly,
}: {
  items: BasketStoredItem[];
  tip: BasketTipInput;
  giftCardCodes: string[];
  contact: ContactDetails;
  delivery: DeliveryDetails;
  dispatch: DispatchSelection | null;
  authAccessToken: string;
  isAuthenticated: boolean;
  selectedSavedPaymentMethodId: string;
  savePaymentMethod: boolean;
  quote: BasketQuote;
  isDigitalOnly: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [localError, setLocalError] = useState("");
  const [paymentProgressMessage, setPaymentProgressMessage] = useState("");
  const usingSavedPaymentMethod = Boolean(selectedSavedPaymentMethodId);
  const expressLineItems = useMemo(() => buildExpressLineItems(quote), [quote]);
  const expressShippingRates = useMemo(
    () => buildExpressShippingRates(quote.shippingCents),
    [quote.shippingCents],
  );

  const finalizePayment = async (params: {
    attemptId: string;
    confirmationTokenId?: string;
    flow: CheckoutFlow;
    savedPaymentMethodId?: string;
    savePaymentMethod?: boolean;
    paymentContact?: ContactDetails;
    paymentDelivery?: DeliveryDetails;
  }) => {
    await finalizeCheckoutPayment({
      stripe,
      items,
      tip,
      giftCardCodes,
      contact,
      delivery,
      dispatch,
      authAccessToken,
      setPaymentProgressMessage,
      ...params,
    });
  };

  const handleExpressConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) {
      const message = "Payment form is still loading. Please wait.";
      setLocalError(message);
      event.paymentFailed({
        reason: "fail",
        message,
      });
      return;
    }

    if (!isDigitalOnly && !dispatch?.dispatchDate) {
      const message = "Choose a dispatch date from your basket before checkout.";
      setLocalError(message);
      event.paymentFailed({
        reason: "invalid_shipping_address",
        message,
      });
      return;
    }

    if (!isDigitalOnly && event.shippingAddress && !isSupportedCountryCode(event.shippingAddress.address.country)) {
      const message = "We only deliver to the United Kingdom.";
      setLocalError(message);
      event.paymentFailed({
        reason: "address_unserviceable",
        message,
      });
      return;
    }

    setLocalError("");
    setPaymentProgressMessage("");
    const attemptId = createCheckoutAttemptId();

    try {
      const submitResult = await withCheckoutClientTiming(
        attemptId,
        "elements.submit",
        () =>
          withTimeout(
            elements.submit(),
            STRIPE_PREPARE_TIMEOUT_MS,
            "Stripe is taking too long to validate the payment form. Please try again.",
          ),
        {
          flow: "express",
        },
      );
      if (submitResult.error) {
        throw new Error(stripeErrorText(submitResult.error));
      }

      const confirmationResult = await withCheckoutClientTiming(
        attemptId,
        "stripe.createConfirmationToken",
        () =>
          withTimeout(
            stripe.createConfirmationToken({
              elements,
              params: {
                payment_method_data: {
                  billing_details: buildExpressBillingDetails(event, contact, delivery),
                },
                shipping: isDigitalOnly ? undefined : buildExpressShipping(event, contact),
              },
            }),
            STRIPE_PREPARE_TIMEOUT_MS,
            "Stripe is taking too long to prepare this payment. Please try again.",
          ),
        {
          flow: "express",
          itemCount: items.length,
        },
      );

      if (confirmationResult.error || !confirmationResult.confirmationToken?.id) {
        throw new Error(stripeErrorText(confirmationResult.error));
      }

      await finalizePayment({
        attemptId,
        confirmationTokenId: confirmationResult.confirmationToken.id,
        flow: "express",
        paymentContact: buildExpressContactPayload(event, contact),
        paymentDelivery: isDigitalOnly ? undefined : buildExpressDeliveryPayload(event, delivery),
        savePaymentMethod: isAuthenticated && savePaymentMethod,
      });
    } catch (error) {
      const message = stripeErrorText(error);
      setLocalError(message);
      event.paymentFailed({
        reason: getExpressFailureReason(message),
        message,
      });
    }
  };

  return (
    <div className={styles.expressCheckoutTop}>
      <div className={styles.expressCheckoutWrap}>
        <p className={styles.expressCheckoutLabel}>Express checkout</p>
        <ExpressCheckoutElement
          options={{
            allowedShippingCountries: SUPPORTED_COUNTRIES.map((country) => country.code),
            billingAddressRequired: false,
            buttonHeight: 55,
            buttonTheme: {
              applePay: "black",
              googlePay: "black",
            },
            buttonType: {
              applePay: "check-out",
              googlePay: "checkout",
              paypal: "buynow",
            },
            emailRequired: true,
            layout: {
              maxColumns: 1,
              maxRows: 3,
            },
            paymentMethodOrder: ["apple_pay", "google_pay", "paypal"],
            paymentMethods: {
              applePay: "always",
              googlePay: "always",
              link: "never",
              paypal: "auto",
              amazonPay: "never",
            },
            phoneNumberRequired: false,
            shippingAddressRequired: !isDigitalOnly,
            lineItems: expressLineItems,
            shippingRates: expressShippingRates,
          }}
          onClick={(event) => {
            event.resolve({
              lineItems: expressLineItems,
              shippingRates: expressShippingRates,
            });
          }}
          onShippingAddressChange={(event) => {
            if (!isSupportedCountryCode(event.address.country)) {
              event.reject();
              return;
            }

            event.resolve({
              lineItems: expressLineItems,
              shippingRates: expressShippingRates,
            });
          }}
          onShippingRateChange={(event) => {
            event.resolve({
              lineItems: expressLineItems,
              shippingRates: expressShippingRates,
            });
          }}
          onConfirm={handleExpressConfirm}
        />
        <div className={styles.expressCheckoutDivider}>
          <span>{usingSavedPaymentMethod ? "Or pay with your saved card" : "Or pay with card"}</span>
        </div>
      </div>

      {localError ? <p className={styles.errorText}>{localError}</p> : null}
      {paymentProgressMessage ? <p className={styles.sectionNote}>{paymentProgressMessage}</p> : null}
    </div>
  );
}

function PaymentElementForm({
  items,
  tip,
  giftCardCodes,
  contact,
  delivery,
  dispatch,
  authAccessToken,
  isAuthenticated,
  savedPaymentMethods,
  selectedSavedPaymentMethodId,
  onSelectedSavedPaymentMethodChange,
  savePaymentMethod,
  onSavePaymentMethodChange,
  isDigitalOnly,
  stripeAmountCents,
}: {
  items: BasketStoredItem[];
  tip: BasketTipInput;
  giftCardCodes: string[];
  contact: ContactDetails;
  delivery: DeliveryDetails;
  dispatch: DispatchSelection | null;
  authAccessToken: string;
  isAuthenticated: boolean;
  savedPaymentMethods: SavedPaymentMethod[];
  selectedSavedPaymentMethodId: string;
  onSelectedSavedPaymentMethodChange: (paymentMethodId: string) => void;
  savePaymentMethod: boolean;
  onSavePaymentMethodChange: (value: boolean) => void;
  isDigitalOnly: boolean;
  stripeAmountCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const [paymentProgressMessage, setPaymentProgressMessage] = useState("");
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const [hasPaymentMethodSelection, setHasPaymentMethodSelection] = useState(false);
  const usingSavedPaymentMethod = Boolean(selectedSavedPaymentMethodId);

  useEffect(() => {
    setIsPaymentElementReady(false);
    setHasPaymentMethodSelection(false);
    setPaymentProgressMessage("");
  }, [usingSavedPaymentMethod]);

  const finalizePayment = async (params: {
    attemptId: string;
    confirmationTokenId?: string;
    flow: CheckoutFlow;
    savedPaymentMethodId?: string;
    savePaymentMethod?: boolean;
    paymentContact?: ContactDetails;
    paymentDelivery?: DeliveryDetails;
  }) => {
    await finalizeCheckoutPayment({
      stripe,
      items,
      tip,
      giftCardCodes,
      contact,
      delivery,
      dispatch,
      authAccessToken,
      setPaymentProgressMessage,
      ...params,
    });
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateManualCheckoutDetails(contact, delivery, dispatch, !isDigitalOnly);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (usingSavedPaymentMethod) {
      const attemptId = createCheckoutAttemptId();
      setIsSubmitting(true);
      setLocalError("");

      try {
        await finalizePayment({
          attemptId,
          flow: "saved_card",
          savedPaymentMethodId: selectedSavedPaymentMethodId,
        });
      } catch (error) {
        setLocalError(stripeErrorText(error));
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!stripe || !elements) {
      setLocalError("Payment form is still loading. Please wait.");
      return;
    }

    if (!isPaymentElementReady) {
      setLocalError("Payment form is still loading. Please wait.");
      return;
    }

    if (!hasPaymentMethodSelection) {
      setLocalError("Choose a payment method before continuing.");
      return;
    }

    setIsSubmitting(true);
    setLocalError("");
    setPaymentProgressMessage("");
    const attemptId = createCheckoutAttemptId();

    try {
      const submitResult = await withCheckoutClientTiming(
        attemptId,
        "elements.submit",
        () =>
          withTimeout(
            elements.submit(),
            STRIPE_PREPARE_TIMEOUT_MS,
            "Stripe is taking too long to validate the payment form. Please try again.",
          ),
        {
          flow: "manual_card",
        },
      );
      if (submitResult.error) {
        throw new Error(stripeErrorText(submitResult.error));
      }

      const confirmationResult = await withCheckoutClientTiming(
        attemptId,
        "stripe.createConfirmationToken",
        () =>
          withTimeout(
            stripe.createConfirmationToken({
              elements,
              params: {
                payment_method_data: {
                  billing_details: isDigitalOnly
                    ? buildDigitalBillingDetails(contact)
                    : buildManualBillingDetails(contact, delivery),
                },
                shipping: isDigitalOnly ? undefined : buildManualShipping(delivery, contact.phone),
              },
            }),
            STRIPE_PREPARE_TIMEOUT_MS,
            "Stripe is taking too long to prepare this payment. Please try again.",
          ),
        {
          flow: "manual_card",
          itemCount: items.length,
        },
      );

      if (confirmationResult.error || !confirmationResult.confirmationToken?.id) {
        throw new Error(stripeErrorText(confirmationResult.error));
      }

      await finalizePayment({
        attemptId,
        confirmationTokenId: confirmationResult.confirmationToken.id,
        flow: "manual_card",
        paymentContact: buildCheckoutContactPayload(contact),
        paymentDelivery: isDigitalOnly ? undefined : buildCheckoutDeliveryPayload(delivery),
        savePaymentMethod: isAuthenticated && savePaymentMethod,
      });
    } catch (error) {
      setLocalError(stripeErrorText(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.stripeForm} onSubmit={handleManualSubmit}>
      {savedPaymentMethods.length > 0 ? (
        <div className={styles.savedPaymentMethods}>
          <p className={styles.savedPaymentHeading}>Saved payment methods</p>
          <p className={styles.savedPaymentScrollHint}>Swipe left or right to view all payment options.</p>
          <div className={styles.savedPaymentList} data-mobile-scroll="true">
            {savedPaymentMethods.map((paymentMethod) => (
              <label key={paymentMethod.id} className={`${styles.savedPaymentOption} whiteFrame`}>
                <div className={styles.paymentHeading}>
                  <input
                    type="radio"
                    name="saved-payment-method"
                    checked={selectedSavedPaymentMethodId === paymentMethod.id}
                    onChange={() => onSelectedSavedPaymentMethodChange(paymentMethod.id)}
                  />
                  <span>
                    {formatCardBrand(paymentMethod.brand)} ending in {paymentMethod.last4}
                  </span>
                </div>
                <span className={styles.paymentDetail}>
                  Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                </span>
              </label>
            ))}
            <label className={`${styles.savedPaymentOption} whiteFrame`}>
              <div className={styles.paymentHeading}>
                <input
                  type="radio"
                  name="saved-payment-method"
                  checked={!usingSavedPaymentMethod}
                  onChange={() => onSelectedSavedPaymentMethodChange("")}
                />
                <span>Use a new card</span>
              </div>
              <span className={styles.paymentDetail}>Pay once or save it for later</span>
            </label>
          </div>
        </div>
      ) : null}

      {usingSavedPaymentMethod ? (
        <div className={`${styles.savedPaymentSummary} whiteFrame`}>
          <p className={styles.sectionNote}>
            {isDigitalOnly
              ? "Your gift card code will be sent to your contact email."
              : "Your delivery details above will be used for this saved-card payment."}
          </p>
        </div>
      ) : (
        <>
          <div className={`${styles.paymentElement} whiteFrame`}>
            <PaymentElement
              options={PAYMENT_ELEMENT_OPTIONS}
              onReady={() => setIsPaymentElementReady(true)}
              onChange={(event) => setHasPaymentMethodSelection(Boolean(event.value?.type))}
            />
          </div>

          {isAuthenticated ? (
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={savePaymentMethod}
                onChange={(event) => onSavePaymentMethodChange(event.target.checked)}
              />
              <span>Save this card to my account for faster checkout next time</span>
            </label>
          ) : null}
        </>
      )}

      {localError ? <p className={styles.errorText}>{localError}</p> : null}
      {paymentProgressMessage ? <p className={styles.sectionNote}>{paymentProgressMessage}</p> : null}

      <button
        type="submit"
        className={styles.payButton}
        disabled={isSubmitting || (!usingSavedPaymentMethod && !isPaymentElementReady)}
        >
          {isSubmitting
            ? "Processing..."
            : usingSavedPaymentMethod
              ? `Pay ${formatPriceFromCents(stripeAmountCents)} with saved card`
              : "Pay securely"}
        </button>
    </form>
  );
}

export default function CheckoutClient() {
  const [items, setItems] = useState<BasketStoredItem[]>([]);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection | null>(null);
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [giftCardCodes, setGiftCardCodes] = useState<string[]>(getStoredCheckoutGiftCardCodes);
  const [giftCardEntry, setGiftCardEntry] = useState("");
  const [giftCardApplyError, setGiftCardApplyError] = useState("");
  const [isGiftCardApplying, setIsGiftCardApplying] = useState(false);
  const [isZeroDueSubmitting, setIsZeroDueSubmitting] = useState(false);
  const [zeroDueError, setZeroDueError] = useState("");
  const [contact, setContact] = useState<ContactDetails>({ email: "", phone: "" });
  const [delivery, setDelivery] = useState<DeliveryDetails>(defaultDelivery);
  const [tipChoice, setTipChoice] = useState<"none" | "custom" | (typeof TIP_PRESET_OPTIONS)[number]>("none");
  const [customTip, setCustomTip] = useState("0.00");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [authAccessToken, setAuthAccessToken] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<number | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedSavedPaymentMethodId, setSelectedSavedPaymentMethodId] = useState("");
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [accountLoadError, setAccountLoadError] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState("");
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isAccountLoading, setIsAccountLoading] = useState(false);

  const tipRequest = useMemo<BasketTipInput>(() => {
    if (!CHECKOUT_TIPS_ENABLED) {
      return { mode: "none" };
    }

    if (tipChoice === "custom") {
      return {
        mode: "custom",
        amount: customTip,
      };
    }

    if (tipChoice === "none") {
      return { mode: "none" };
    }

    return {
      mode: "percent",
      percent: tipChoice,
    };
  }, [customTip, tipChoice]);

  const isAuthenticated = Boolean(authAccessToken);

  const stripeOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!quote || quote.stripeAmountCents <= 0) {
      return null;
    }

    return {
      amount: quote.stripeAmountCents,
      currency: quote.currency,
      mode: "payment",
      paymentMethodTypes: [...CHECKOUT_PAYMENT_METHOD_TYPES],
      paymentMethodCreation: "manual",
      appearance: publicStripeAppearance,
    };
  }, [quote]);

  const tipSelectionLabel =
    tipChoice === "custom" ? "Custom tip" : tipChoice === "none" ? "No tip" : `${tipChoice}% tip`;
  const customTipPreviewCents =
    tipChoice === "custom" ? quote?.tipCents ?? 0 : parseMoneyTextToCents(customTip);
  const hasSavedAddresses = savedAddresses.length > 0;
  const selectedSavedAddress =
    selectedSavedAddressId === null
      ? null
      : savedAddresses.find((address) => address.id === selectedSavedAddressId) ?? null;
  const addressSearchQuery = normalizeText(delivery.address);
  const normalizedPostcode = normalizeText(delivery.postcode);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setAuthAccessToken(data.session?.access_token ?? "");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthAccessToken(session?.access_token ?? "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authAccessToken) {
      setSavedAddresses([]);
      setSelectedSavedAddressId(null);
      setSavedPaymentMethods([]);
      setSelectedSavedPaymentMethodId("");
      setSavePaymentMethod(false);
      setAccountLoadError("");
      setIsAccountLoading(false);
      return;
    }

    const abortController = new AbortController();

    async function loadAccountData() {
      setIsAccountLoading(true);
      setAccountLoadError("");

      try {
        const headers = {
          Authorization: `Bearer ${authAccessToken}`,
        };

        const response = await fetch("/api/account/checkout", {
          headers,
          cache: "no-store",
          signal: abortController.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as CheckoutAccountResponse;

        if (!response.ok) {
          throw new Error(payload.error || "We could not load your saved checkout details.");
        }

        const profile = payload.profile;
        const addresses = (Array.isArray(payload.addresses) ? payload.addresses : []).filter(
          (address) => getCountryCodeFromLabel(getCountryLabel(address.country) || address.country) === "GB",
        );
        const paymentMethods = Array.isArray(payload.paymentMethods) ? payload.paymentMethods : [];
        const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

        if (profile) {
          const nextContact = mapProfileToContact(profile);
          setContact((current) => ({
            email: current.email || nextContact.email,
            phone: current.phone || nextContact.phone,
          }));
          setMarketingOptIn(profile.marketingOptIn);
        }

        setSavedAddresses(addresses);
        setSelectedSavedAddressId((current) => {
          if (current && addresses.some((address) => address.id === current)) {
            return current;
          }

          return defaultAddress?.id ?? null;
        });
        setSavedPaymentMethods(paymentMethods);
        setSelectedSavedPaymentMethodId((current) => {
          if (current && paymentMethods.some((paymentMethod) => paymentMethod.id === current)) {
            return current;
          }

          return paymentMethods[0]?.id ?? "";
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setAccountLoadError(
          error instanceof Error ? error.message : "We could not load your saved checkout details.",
        );
        setSavedAddresses([]);
        setSelectedSavedAddressId(null);
        setSavedPaymentMethods([]);
        setSelectedSavedPaymentMethodId("");
      } finally {
        if (!abortController.signal.aborted) {
          setIsAccountLoading(false);
        }
      }
    }

    void loadAccountData();

    return () => {
      abortController.abort();
    };
  }, [authAccessToken]);

  useEffect(() => {
    if (!selectedSavedAddressId) {
      return;
    }

    const selectedAddress = savedAddresses.find((address) => address.id === selectedSavedAddressId);
    if (!selectedAddress) {
      return;
    }

    setDelivery(mapAddressToDelivery(selectedAddress));
    setContact((current) => ({
      ...current,
      phone: selectedAddress.phone || current.phone,
    }));
  }, [savedAddresses, selectedSavedAddressId]);

  useEffect(() => {
    const refresh = () => setItems(getBasket());
    const handleUpdate = () => refresh();

    refresh();
    window.addEventListener("storage", handleUpdate);
    window.addEventListener(BASKET_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(BASKET_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setDispatchSelection(getDispatchSelection());
    const handleUpdate = () => refresh();

    refresh();
    window.addEventListener("storage", handleUpdate);
    window.addEventListener(DISPATCH_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(DISPATCH_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    try {
      if (giftCardCodes.length === 0) {
        window.sessionStorage.removeItem(CHECKOUT_GIFT_CARD_STORAGE_KEY);
        return;
      }

      window.sessionStorage.setItem(CHECKOUT_GIFT_CARD_STORAGE_KEY, JSON.stringify(giftCardCodes));
    } catch {
      // Session storage can be unavailable in private or restricted browser contexts.
    }
  }, [giftCardCodes]);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    const abortController = new AbortController();

    const loadQuote = async () => {
      try {
        const response = await fetch("/api/basket/quote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items,
            tip: tipRequest,
            dispatch: dispatchSelection,
            giftCardCodes,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(error.error || "Could not load checkout totals.");
        }

        const nextQuote = (await response.json()) as BasketQuote;
        setQuote(nextQuote);
        setQuoteError("");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setQuote(null);
        setQuoteError(error instanceof Error ? error.message : "Could not load checkout totals.");
      }
    };

    void loadQuote();

    return () => {
      abortController.abort();
    };
  }, [dispatchSelection, giftCardCodes, items, tipRequest]);

  useEffect(() => {
    if (!savedPaymentMethods.some((paymentMethod) => paymentMethod.id === selectedSavedPaymentMethodId)) {
      setSelectedSavedPaymentMethodId("");
    }
  }, [savedPaymentMethods, selectedSavedPaymentMethodId]);

  useEffect(() => {
    if (selectedSavedAddressId && !savedAddresses.some((address) => address.id === selectedSavedAddressId)) {
      setSelectedSavedAddressId(null);
    }
  }, [savedAddresses, selectedSavedAddressId]);

  useEffect(() => {
    if (selectedSavedAddressId || addressSearchQuery.length >= 3 || normalizedPostcode.length >= 3) {
      return;
    }

    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setAddressSearchLoading(false);
    setAddressSearchError("");
  }, [addressSearchQuery, normalizedPostcode, selectedSavedAddressId]);

  const performAddressSearch = async () => {
    if (selectedSavedAddressId) {
      return;
    }

    if (!normalizedPostcode) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressSearchError("Enter a postcode to search for an address.");
      return;
    }

    setAddressSearchLoading(true);
    setAddressSearchError("");

    try {
      const query = addressSearchQuery ? `${normalizedPostcode} ${addressSearchQuery}` : normalizedPostcode;
      const params = new URLSearchParams({
        q: query,
        country: delivery.country,
        postcode: normalizedPostcode,
      });
      const response = await fetch(`/api/address-search?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { suggestions?: AddressSuggestion[] };
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      setAddressSuggestions(suggestions);
      setShowAddressSuggestions(suggestions.length > 0);

      if (!response.ok) {
        setAddressSearchError("Address search is unavailable right now.");
        return;
      }

      if (suggestions.length === 0) {
        setAddressSearchError("No matching addresses found.");
      }
    } catch {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressSearchError("Address search is unavailable right now.");
    } finally {
      setAddressSearchLoading(false);
    }
  };

  const requestQuoteWithGiftCards = async (codes: string[]) => {
    const response = await fetch("/api/basket/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items,
        tip: tipRequest,
        dispatch: dispatchSelection,
        giftCardCodes: codes,
      }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(error.error || "Could not apply gift card.");
    }

    return (await response.json()) as BasketQuote;
  };

  const applyGiftCardCode = async () => {
    const nextCode = normalizeText(giftCardEntry);
    if (!nextCode) {
      setGiftCardApplyError("Enter a gift card code.");
      return;
    }

    const candidateCodes = [...giftCardCodes, nextCode];
    setIsGiftCardApplying(true);
    setGiftCardApplyError("");

    try {
      const nextQuote = await requestQuoteWithGiftCards(candidateCodes);
      setQuote(nextQuote);
      setQuoteError("");
      setGiftCardCodes(nextQuote.giftCardApplications.map((application) => application.code));
      setGiftCardEntry("");
    } catch (error) {
      setGiftCardApplyError(error instanceof Error ? error.message : "Could not apply gift card.");
    } finally {
      setIsGiftCardApplying(false);
    }
  };

  const removeGiftCardCode = (code: string) => {
    setGiftCardCodes((current) => current.filter((currentCode) => currentCode !== code));
    setGiftCardApplyError("");
  };

  const updateDelivery = <K extends keyof DeliveryDetails>(key: K, value: DeliveryDetails[K]) => {
    setSelectedSavedAddressId(null);
    setDelivery((current) => ({ ...current, [key]: value }));
  };

  const applyAddressSuggestion = (suggestion: AddressSuggestion) => {
    setSelectedSavedAddressId(null);
    setDelivery((current) => ({
      ...current,
      address: suggestion.addressLine1,
      city: suggestion.city,
      postcode: suggestion.postcode,
      country: suggestion.country || current.country,
    }));
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setAddressSearchError("");
  };

  const updateContactPhone = (value: string) => {
    setSelectedSavedAddressId(null);
    setContact((current) => ({ ...current, phone: value }));
  };

  const setPresetTip = (value: Exclude<typeof tipChoice, "custom">) => {
    setTipChoice(value);
  };

  const incrementCustomTip = (delta: number) => {
    setTipChoice("custom");
    const nextCents = Math.max(0, parseMoneyTextToCents(customTip) + delta * 100);
    setCustomTip((nextCents / 100).toFixed(2));
  };

  const placeZeroDueOrder = async () => {
    const validationError = validateManualCheckoutDetails(
      contact,
      delivery,
      checkoutDispatchSelection,
      !isDigitalOnly,
    );

    if (validationError) {
      setZeroDueError(validationError);
      return;
    }

    if (!quote || quote.stripeAmountCents > 0 || quote.giftCardAppliedCents <= 0) {
      setZeroDueError("A card payment is still due for this order.");
      return;
    }

    setIsZeroDueSubmitting(true);
    setZeroDueError("");

    try {
      const response = await fetch("/api/checkout/zero-due", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authAccessToken ? { Authorization: `Bearer ${authAccessToken}` } : {}),
        },
        body: JSON.stringify({
          items,
          tip: tipRequest,
          giftCardCodes,
          contact: buildCheckoutContactPayload(contact),
          delivery: isDigitalOnly ? undefined : buildCheckoutDeliveryPayload(delivery),
          dispatch: checkoutDispatchSelection,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        error?: string;
      };

      if (!response.ok || !payload.orderId) {
        throw new Error(payload.error || "Could not place this order.");
      }

      window.location.href = `/checkout/success?orderId=${encodeURIComponent(payload.orderId)}&gift_card_order=true`;
    } catch (error) {
      setZeroDueError(error instanceof Error ? error.message : "Could not place this order.");
    } finally {
      setIsZeroDueSubmitting(false);
    }
  };

  const lines = quote?.lines ?? [];
  const isGiftCardBasket = items.length > 0 && items.every((item) => item.slug === "gift-card");
  const isDigitalOnly = lines.length > 0 ? lines.every((item) => item.isGiftCard) : isGiftCardBasket;
  const checkoutDispatchSelection =
    isDigitalOnly || (quote?.dispatchDate && dispatchSelection?.dispatchDate === quote.dispatchDate)
      ? dispatchSelection
      : null;
  const shippingCents = quote?.shippingCents ?? 0;
  const tipCents = quote?.tipCents ?? 0;
  const totalCents = quote?.totalCents ?? 0;
  const giftCardAppliedCents = quote?.giftCardAppliedCents ?? 0;
  const stripeAmountCents = quote?.stripeAmountCents ?? totalCents;
  const isZeroDue = Boolean(quote && quote.giftCardAppliedCents > 0 && quote.stripeAmountCents <= 0);
  const stripeConfigError = stripePromise || isZeroDue ? "" : "Stripe is not configured.";
  const giftCardDisplayItems =
    quote && quote.giftCardApplications.length > 0
      ? quote.giftCardApplications
      : giftCardCodes.map((code) => ({
          code,
          appliedCents: 0,
          balanceBeforeCents: 0,
          balanceAfterCents: 0,
        }));

  return (
    <section className={styles.checkout}>
      <div className={styles.columns}>
        <div className={styles.formColumn}>
          {items.length === 0 ? (
            <div className={`${styles.emptyState} whiteFrame`}>
              <h1>Your basket is empty</h1>
              <p>Add some cookies to your basket before heading to checkout.</p>
              <Link href="/shop" className={styles.returnLink}>
                Browse the shop
              </Link>
            </div>
          ) : (
            <CheckoutElementsShell options={stripeOptions}>
              {quote && stripeOptions && stripePromise ? (
                <ExpressCheckoutSection
                  items={items}
                  tip={tipRequest}
                  giftCardCodes={giftCardCodes}
                  contact={contact}
                  delivery={delivery}
                  dispatch={checkoutDispatchSelection}
                  authAccessToken={authAccessToken}
                  isAuthenticated={isAuthenticated}
                  selectedSavedPaymentMethodId={selectedSavedPaymentMethodId}
                  savePaymentMethod={savePaymentMethod}
                  quote={quote}
                  isDigitalOnly={isDigitalOnly}
                />
              ) : null}

              <section className={styles.section}>
                <h2>Contact</h2>
                <div className={styles.fieldStack}>
                  <label className={`${styles.field} whiteFrame`}>
                    <span>Email address</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={contact.email}
                      onChange={(event) => setContact((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </label>

                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(event) => setMarketingOptIn(event.target.checked)}
                    />
                    <span>Email me with news and offers</span>
                  </label>
                </div>
              </section>

              {isDigitalOnly ? null : (
                <section className={styles.section}>
                <h2>Delivery</h2>
                <div className={styles.fieldStack}>
                  {isAuthenticated && hasSavedAddresses ? (
                    <div className={styles.savedAddressPicker}>
                      <p className={styles.savedPaymentHeading}>Saved addresses</p>
                      <div className={styles.savedPaymentList}>
                        {savedAddresses.map((address) => (
                          <label key={address.id} className={`${styles.savedAddressOption} whiteFrame`}>
                            <div className={styles.paymentHeading}>
                              <input
                                type="radio"
                                name="saved-address"
                                checked={selectedSavedAddressId === address.id}
                                onChange={() => setSelectedSavedAddressId(address.id)}
                              />
                              <span>{getSavedAddressLabel(address)}</span>
                            </div>
                            <span className={styles.savedAddressMeta}>
                              {[address.addressLine1, address.addressLine2, address.city, address.postcode]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </label>
                        ))}
                        <label className={`${styles.savedAddressOption} whiteFrame`}>
                          <div className={styles.paymentHeading}>
                            <input
                              type="radio"
                              name="saved-address"
                              checked={selectedSavedAddressId === null}
                              onChange={() => setSelectedSavedAddressId(null)}
                            />
                            <span>Enter a new address</span>
                          </div>
                          <span className={styles.savedAddressMeta}>
                            Use a different delivery address for this order
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {selectedSavedAddress ? (
                    <div className={`${styles.savedAddressSummary} whiteFrame`}>
                      <p className={styles.savedAddressSummaryTitle}>Using saved address</p>
                      <p className={styles.savedAddressSummaryText}>
                        {[selectedSavedAddress.firstName, selectedSavedAddress.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p className={styles.savedAddressSummaryText}>
                        {[
                          selectedSavedAddress.addressLine1,
                          selectedSavedAddress.addressLine2,
                          selectedSavedAddress.city,
                          selectedSavedAddress.postcode,
                          selectedSavedAddress.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {contact.phone ? (
                        <p className={styles.savedAddressSummaryText}>Phone: {contact.phone}</p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <label className={`${styles.field} ${styles.selectField}`}>
                        <span>Country/Region</span>
                        <select
                          value={delivery.country}
                          onChange={(event) => updateDelivery("country", event.target.value)}
                        >
                          {SUPPORTED_COUNTRIES.map((country) => (
                            <option key={country.code}>{country.label}</option>
                          ))}
                        </select>
                        <FiChevronDown />
                      </label>

                      <div className={styles.twoUp}>
                        <label className={`${styles.field} ${styles.fullWidthField}`}>
                          <span>Full name</span>
                          <input
                            type="text"
                            value={delivery.fullName}
                            autoComplete="name"
                            onChange={(event) => updateDelivery("fullName", event.target.value)}
                          />
                        </label>
                      </div>

                      <label className={`${styles.field} whiteFrame`}>
                        <span>Address</span>
                        <input
                          type="text"
                          value={delivery.address}
                          autoComplete="address-line1"
                          onChange={(event) => updateDelivery("address", event.target.value)}
                          onFocus={() => {
                            if (addressSuggestions.length > 0) {
                              setShowAddressSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            window.setTimeout(() => setShowAddressSuggestions(false), 150);
                          }}
                        />
                        {showAddressSuggestions && addressSuggestions.length > 0 ? (
                          <div className={`${styles.addressSuggestions} whiteFrame`} role="listbox" aria-label="Address suggestions">
                            {addressSuggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.addressLine1}-${suggestion.postcode}`}
                                type="button"
                                className={`${styles.addressSuggestion} whiteFrame`}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyAddressSuggestion(suggestion)}
                              >
                                <span>{suggestion.label}</span>
                                <small>{suggestion.secondaryLabel}</small>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </label>
                      {addressSearchLoading ? (
                        <p className={styles.fieldHint}>Searching for addresses…</p>
                      ) : null}
                      {addressSearchError ? <p className={styles.errorText}>{addressSearchError}</p> : null}

                      <label className={`${styles.field} whiteFrame`}>
                        <span>Flat number (optional)</span>
                        <input
                          type="text"
                          value={delivery.flatNumber}
                          autoComplete="address-line2"
                          onChange={(event) => updateDelivery("flatNumber", event.target.value)}
                        />
                      </label>

                      <div className={styles.twoUp}>
                        <label className={`${styles.field} whiteFrame`}>
                          <span>City</span>
                          <input
                            type="text"
                            value={delivery.city}
                            autoComplete="address-level2"
                            onChange={(event) => updateDelivery("city", event.target.value)}
                          />
                        </label>
                        <label className={`${styles.field} ${styles.iconField}`}>
                          <span>Postcode</span>
                          <input
                            type="text"
                            value={delivery.postcode}
                            autoComplete="postal-code"
                            onChange={(event) => updateDelivery("postcode", event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void performAddressSearch();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className={styles.searchButton}
                            aria-label="Search postcode for address suggestions"
                            disabled={addressSearchLoading || Boolean(selectedSavedAddressId)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              void performAddressSearch();
                            }}
                          >
                            <FiSearch />
                          </button>
                        </label>
                      </div>

                      <label className={`${styles.field} ${styles.iconField}`}>
                        <span>Phone (optional)</span>
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={(event) => updateContactPhone(event.target.value)}
                        />
                        <span className={styles.flag}>GB</span>
                      </label>
                    </>
                  )}
                </div>
                </section>
              )}

              {isDigitalOnly ? (
                <section className={styles.section}>
                  <h2>Digital delivery</h2>
                  <div className={`${styles.methodCard} whiteFrame`}>
                    <span>Gift card code</span>
                    <strong>Email</strong>
                  </div>
                </section>
              ) : (
                <section className={styles.section}>
                  <h2>Shipping method</h2>
                  <div className={`${styles.methodCard} whiteFrame`}>
                    <span>{UK_POSTAL_SHIPPING_LABEL}</span>
                    <strong>{formatPriceFromCents(shippingCents)}</strong>
                  </div>
                  <p className={styles.sectionNote}>
                    Dispatch date:{" "}
                    {checkoutDispatchSelection?.dispatchDate
                      ? formatDispatchDate(checkoutDispatchSelection.dispatchDate)
                      : "Choose a dispatch date in your basket before paying."}
                  </p>
                </section>
              )}

              {CHECKOUT_TIPS_ENABLED ? (
                <section className={styles.section}>
                  <h2>Add tip</h2>
                  <div className={`${styles.tipCard} whiteFrame`}>
                    <div className={styles.tipCardHeader}>
                      <div className={styles.tipIntro}>
                        <span className={styles.tipEyebrow}>Optional tip</span>
                        <p className={styles.tipTitle}>Show your support for the team at Grown Cookies</p>
                      </div>
                      <div className={`${styles.tipSummary} whiteFrame`}>
                        <span>{tipSelectionLabel}</span>
                        <strong>{formatPriceFromCents(tipCents)}</strong>
                      </div>
                    </div>

                    <div className={styles.tipGrid}>
                      {TIP_PRESET_OPTIONS.map((value) => {
                        const optionAmount =
                          quote?.tipOptions.find((option) => option.percent === value)?.amountCents ?? 0;

                        return (
                          <button
                            key={value}
                            type="button"
                            className={tipChoice === value ? styles.tipButtonActive : styles.tipButton}
                            onClick={() => setPresetTip(value)}
                          >
                            <strong>{value}%</strong>
                            <span>{formatPriceFromCents(optionAmount)}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={tipChoice === "none" ? styles.tipButtonActive : styles.tipButton}
                        onClick={() => setPresetTip("none")}
                      >
                        <strong>None</strong>
                        <span>{formatPriceFromCents(0)}</span>
                      </button>
                    </div>

                    <div className={`${styles.customTipSection} whiteFrame`}>
                      <div className={styles.customTipHeader}>
                        <span>Custom tip</span>
                        <strong>{formatPriceFromCents(customTipPreviewCents)}</strong>
                      </div>
                      <div className={styles.customTipRow}>
                        <label
                          className={
                            tipChoice === "custom" ? styles.customTipFieldActive : styles.customTipField
                          }
                        >
                          <span>Amount</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={customTip}
                            onChange={(event) => {
                              setTipChoice("custom");
                              setCustomTip(event.target.value);
                            }}
                          />
                        </label>
                        <div className={styles.stepper}>
                          <button type="button" onClick={() => incrementCustomTip(-1)}>
                            <FiMinus />
                          </button>
                          <button type="button" onClick={() => incrementCustomTip(1)}>
                            <FiPlus />
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className={styles.tipMessage}>Thank you, we appreciate it.</p>
                  </div>
                </section>
              ) : null}

              <section className={styles.section}>
                <h2>Gift card</h2>
                <div className={`${styles.giftCardRedeemCard} whiteFrame`}>
                  <div className={styles.giftCardRedeemRow}>
                    <label className={`${styles.field} whiteFrame`}>
                      <span>Gift card code</span>
                      <input
                        type="text"
                        value={giftCardEntry}
                        onChange={(event) => setGiftCardEntry(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void applyGiftCardCode();
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.giftCardApplyButton}
                      disabled={isGiftCardApplying}
                      onClick={() => {
                        void applyGiftCardCode();
                      }}
                    >
                      {isGiftCardApplying ? "Applying..." : "Apply"}
                    </button>
                  </div>

                  {giftCardApplyError ? <p className={styles.errorText}>{giftCardApplyError}</p> : null}

                  {giftCardDisplayItems.length > 0 ? (
                    <div className={styles.appliedGiftCards}>
                      {giftCardDisplayItems.map((application) => (
                        <div key={application.code} className={styles.appliedGiftCard}>
                          <div>
                            <strong>{application.code}</strong>
                            {application.appliedCents > 0 ? (
                              <span>
                                Applied {formatPriceFromCents(application.appliedCents)}. Remaining{" "}
                                {formatPriceFromCents(application.balanceAfterCents)}.
                              </span>
                            ) : (
                              <span>Remove this code to refresh checkout totals.</span>
                            )}
                          </div>
                          <button
                            type="button"
                            className={styles.removeGiftCardButton}
                            onClick={() => removeGiftCardCode(application.code)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={styles.section}>
                <h2>Payment</h2>
                <p className={styles.totalAmount}>
                  <strong>{isZeroDue ? "Amount due:" : "Payment due:"}</strong>{" "}
                  {formatPriceFromCents(stripeAmountCents)}
                </p>
                <p className={styles.sectionNote}>All transactions are secure and encrypted.</p>

                {isAuthenticated && isAccountLoading ? (
                  <p className={styles.sectionNote}>Loading your saved checkout details...</p>
                ) : null}
                {isAuthenticated && accountLoadError ? <p className={styles.errorText}>{accountLoadError}</p> : null}
                {quoteError ? <p className={styles.errorText}>{quoteError}</p> : null}
                {stripeConfigError ? <p className={styles.errorText}>{stripeConfigError}</p> : null}
                {zeroDueError ? <p className={styles.errorText}>{zeroDueError}</p> : null}
                {isZeroDue ? (
                  <div className={`${styles.savedPaymentSummary} whiteFrame`}>
                    <p className={styles.sectionNote}>
                      Your applied gift card balance covers this order. No card details are needed.
                    </p>
                    <button
                      type="button"
                      className={styles.payButton}
                      disabled={isZeroDueSubmitting}
                      onClick={() => {
                        void placeZeroDueOrder();
                      }}
                    >
                      {isZeroDueSubmitting ? "Placing order..." : "Place order"}
                    </button>
                  </div>
                ) : null}
                {!isZeroDue && !quote && !quoteError ? (
                  <p className={styles.sectionNote}>Loading payment methods...</p>
                ) : null}
                {!isZeroDue && quote && stripeOptions && stripePromise ? (
                  <PaymentElementForm
                    items={items}
                    tip={tipRequest}
                    giftCardCodes={giftCardCodes}
                    contact={contact}
                    delivery={delivery}
                    dispatch={checkoutDispatchSelection}
                    authAccessToken={authAccessToken}
                    isAuthenticated={isAuthenticated}
                    savedPaymentMethods={savedPaymentMethods}
                    selectedSavedPaymentMethodId={selectedSavedPaymentMethodId}
                    onSelectedSavedPaymentMethodChange={setSelectedSavedPaymentMethodId}
                    savePaymentMethod={savePaymentMethod}
                    onSavePaymentMethodChange={setSavePaymentMethod}
                    isDigitalOnly={isDigitalOnly}
                    stripeAmountCents={stripeAmountCents}
                  />
                ) : null}
              </section>

              <div className={styles.paymentFooter}>
                <p>
                  <FiLock />
                  Secure and encrypted
                </p>
              </div>
            </CheckoutElementsShell>
          )}
        </div>

        <aside className={styles.summaryColumn}>
          <div className={styles.summaryInner}>
            <ul className={styles.summaryItems}>
              {lines.map((item) => (
                <li
                  key={item.lineId}
                  className={`${styles.summaryItem} ${item.isGiftCard ? styles.summaryItemGiftCard : ""}`}
                >
                  <div
                    className={`${styles.summaryImageWrap} ${
                      item.isGiftCard ? styles.summaryImageWrapGiftCard : ""
                    }`}
                  >
                    {item.image ? (
                      item.isGiftCard ? (
                        <GiftCardTile
                          src={item.image}
                          alt={item.imageAlt ?? item.name}
                          className={styles.summaryGiftCardTile}
                        />
                      ) : (
                        <div className={styles.summaryImageInner}>
                          <Image
                            src={item.image}
                            alt={item.imageAlt ?? item.name}
                            fill
                            className={styles.summaryImage}
                          />
                        </div>
                      )
                    ) : (
                      <div className={styles.summaryImageInner}>
                        <span className={styles.summaryPlaceholder}>No image</span>
                      </div>
                    )}
                    {item.isGiftCard ? null : (
                      <span className={styles.quantityBadge}>{item.quantity}</span>
                    )}
                  </div>

                  <div className={styles.summaryCopy}>
                    <p>{item.name}</p>
                    <span>
                      {item.isGiftCard
                        ? `Gift card value: ${formatGiftCardAmount(item.unitPriceCents)}`
                        : `${item.quantity} ${item.quantity === 1 ? "cookie" : "cookies"}`}
                    </span>
                  </div>

                  <strong>{formatPriceFromCents(item.lineTotalCents)}</strong>
                </li>
              ))}
            </ul>

            <dl className={styles.totals}>
              <div>
                <dt>{isDigitalOnly ? "Digital delivery" : "Delivery fee"}</dt>
                <dd>{isDigitalOnly ? "Email" : formatPriceFromCents(shippingCents)}</dd>
              </div>
              {giftCardAppliedCents > 0 ? (
                <div>
                  <dt>Gift cards</dt>
                  <dd>-{formatPriceFromCents(giftCardAppliedCents)}</dd>
                </div>
              ) : null}
              {!isDigitalOnly ? (
                <div>
                  <dt>Dispatch date</dt>
                  <dd>
                    {checkoutDispatchSelection?.dispatchDate
                      ? formatDispatchDate(checkoutDispatchSelection.dispatchDate)
                      : "Required"}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className={styles.totalRow}>
              <span>{giftCardAppliedCents > 0 ? "To pay" : "Total price"}</span>
              <div>
                <small>£</small>
                <strong>{formatPriceFromCents(stripeAmountCents).replace("£", "")}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
