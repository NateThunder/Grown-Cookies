"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiLock, FiMinus, FiPlus, FiSearch } from "react-icons/fi";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  type StripeElementsOptions,
  type StripeExpressCheckoutElementConfirmEvent,
  loadStripe,
} from "@stripe/stripe-js";
import { BASKET_UPDATED_EVENT, getBasket } from "@/lib/basket-storage";
import {
  TIP_PRESET_OPTIONS,
  formatPriceFromCents,
  parseMoneyTextToCents,
  type BasketQuote,
  type BasketStoredItem,
  type BasketTipInput,
} from "@/lib/basket";
import GiftCardTile from "@/components/gift-card-tile";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer-profiles";
import type { SavedPaymentMethod } from "@/lib/saved-payment-methods";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "@/components/checkout-client.module.css";

type ContactDetails = {
  email: string;
  phone: string;
};

type DeliveryDetails = {
  firstName: string;
  lastName: string;
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
  contact?: ContactDetails;
  delivery?: DeliveryDetails;
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

const SUPPORTED_COUNTRIES = [
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
] as const;

const defaultDelivery = {
  firstName: "",
  lastName: "",
  address: "",
  flatNumber: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
};

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

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

function getCountryCodeFromLabel(label: string) {
  const normalized = normalizeText(label);
  const match = SUPPORTED_COUNTRIES.find((country) => country.label === normalized);
  return match?.code ?? null;
}

function isSupportedCountryCode(code: string) {
  const normalized = normalizeText(code).toUpperCase();
  return SUPPORTED_COUNTRIES.some((country) => country.code === normalized);
}

function buildFullName(firstName: string, lastName: string) {
  return [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(" ");
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

function validateManualCheckoutDetails(contact: ContactDetails, delivery: DeliveryDetails) {
  if (!normalizeText(contact.email)) {
    return "Enter a contact email address.";
  }

  const requiredDeliveryValues = [
    delivery.firstName,
    delivery.lastName,
    delivery.address,
    delivery.city,
    delivery.postcode,
    delivery.country,
  ];

  if (requiredDeliveryValues.some((value) => !normalizeText(value))) {
    return "Enter complete delivery details.";
  }

  if (!getCountryCodeFromLabel(delivery.country)) {
    return "Select a supported delivery country.";
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
    name: buildFullName(delivery.firstName, delivery.lastName),
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
    name: buildFullName(delivery.firstName, delivery.lastName) || undefined,
    email: normalizeText(contact.email) || undefined,
    phone: normalizeText(contact.phone) || undefined,
    address: shipping?.address,
  };

  if (!billingDetails.name && !billingDetails.email && !billingDetails.phone && !billingDetails.address) {
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

  const fallbackName = buildFullName(delivery.firstName, delivery.lastName);
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
    firstName: address.firstName,
    lastName: address.lastName,
    address: address.addressLine1,
    flatNumber: address.addressLine2,
    city: address.city,
    postcode: address.postcode,
    country: address.country || defaultDelivery.country,
  };
}

function PaymentElementForm({
  items,
  tip,
  contact,
  delivery,
  authAccessToken,
  isAuthenticated,
  savedPaymentMethods,
  selectedSavedPaymentMethodId,
  onSelectedSavedPaymentMethodChange,
  savePaymentMethod,
  onSavePaymentMethodChange,
}: {
  items: BasketStoredItem[];
  tip: BasketTipInput;
  contact: ContactDetails;
  delivery: DeliveryDetails;
  authAccessToken: string;
  isAuthenticated: boolean;
  savedPaymentMethods: SavedPaymentMethod[];
  selectedSavedPaymentMethodId: string;
  onSelectedSavedPaymentMethodChange: (paymentMethodId: string) => void;
  savePaymentMethod: boolean;
  onSavePaymentMethodChange: (value: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const [hasExpressMethods, setHasExpressMethods] = useState(false);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const [hasPaymentMethodSelection, setHasPaymentMethodSelection] = useState(false);
  const usingSavedPaymentMethod = Boolean(selectedSavedPaymentMethodId);

  useEffect(() => {
    setIsPaymentElementReady(false);
    setHasPaymentMethodSelection(false);
  }, [usingSavedPaymentMethod]);

  const redirectToSuccess = (params: {
    orderId: string;
    paymentIntentId: string;
    clientSecret?: string;
  }) => {
    window.location.href = buildRedirectUrl(params);
  };

  const finalizePayment = async (params: {
    confirmationTokenId?: string;
    savedPaymentMethodId?: string;
    savePaymentMethod?: boolean;
  }) => {
    const response = await fetch("/api/stripe/confirm-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authAccessToken ? { Authorization: `Bearer ${authAccessToken}` } : {}),
      },
      body: JSON.stringify({
        confirmationTokenId: params.confirmationTokenId,
        savedPaymentMethodId: params.savedPaymentMethodId,
        savePaymentMethod: params.savePaymentMethod,
        items,
        tip,
        contact,
        delivery,
      } satisfies ConfirmPaymentPayload),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(error.error || "Could not finalize payment.");
    }

    const result = (await response.json()) as ConfirmPaymentResponse;
    if (!result.orderId || !result.paymentIntentId || !result.clientSecret || !result.status) {
      throw new Error("Could not finalize payment.");
    }

    if (result.status === "requires_action") {
      if (!stripe) {
        throw new Error("Payment form is still loading. Please wait.");
      }

      const nextActionResult = await stripe.handleNextAction({
        clientSecret: result.clientSecret,
      });

      if (nextActionResult.error) {
        throw new Error(stripeErrorText(nextActionResult.error));
      }

      if (nextActionResult.paymentIntent?.id) {
        redirectToSuccess({
          orderId: result.orderId,
          paymentIntentId: nextActionResult.paymentIntent.id,
          clientSecret: result.clientSecret,
        });
      }

      return;
    }

    if (
      result.status === "succeeded" ||
      result.status === "processing" ||
      result.status === "requires_capture"
    ) {
      redirectToSuccess({
        orderId: result.orderId,
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
      });
      return;
    }

    throw new Error("Payment could not be completed. Please try another payment method.");
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateManualCheckoutDetails(contact, delivery);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (usingSavedPaymentMethod) {
      setIsSubmitting(true);
      setLocalError("");

      try {
        await finalizePayment({
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

    try {
      const submitResult = await elements.submit();
      if (submitResult.error) {
        throw new Error(stripeErrorText(submitResult.error));
      }

      const confirmationResult = await stripe.createConfirmationToken({
        elements,
        params: {
          payment_method_data: {
            billing_details: buildManualBillingDetails(contact, delivery),
          },
          shipping: buildManualShipping(delivery, contact.phone),
        },
      });

      if (confirmationResult.error || !confirmationResult.confirmationToken?.id) {
        throw new Error(stripeErrorText(confirmationResult.error));
      }

      await finalizePayment({
        confirmationTokenId: confirmationResult.confirmationToken.id,
        savePaymentMethod: isAuthenticated && savePaymentMethod,
      });
    } catch (error) {
      setLocalError(stripeErrorText(error));
    } finally {
      setIsSubmitting(false);
    }
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

    if (event.shippingAddress && !isSupportedCountryCode(event.shippingAddress.address.country)) {
      const message = "We only deliver to the United Kingdom, United States, and Canada.";
      setLocalError(message);
      event.paymentFailed({
        reason: "address_unserviceable",
        message,
      });
      return;
    }

    setIsSubmitting(true);
    setLocalError("");

    try {
      const submitResult = await elements.submit();
      if (submitResult.error) {
        throw new Error(stripeErrorText(submitResult.error));
      }

      const confirmationResult = await stripe.createConfirmationToken({
        elements,
        params: {
          payment_method_data: {
            billing_details: buildExpressBillingDetails(event, contact, delivery),
          },
          shipping: buildExpressShipping(event, contact),
        },
      });

      if (confirmationResult.error || !confirmationResult.confirmationToken?.id) {
        throw new Error(stripeErrorText(confirmationResult.error));
      }

      await finalizePayment({
        confirmationTokenId: confirmationResult.confirmationToken.id,
        savePaymentMethod: isAuthenticated && savePaymentMethod,
      });
    } catch (error) {
      const message = stripeErrorText(error);
      setLocalError(message);
      event.paymentFailed({
        reason: getExpressFailureReason(message),
        message,
      });
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
              <label key={paymentMethod.id} className={styles.savedPaymentOption}>
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
            <label className={styles.savedPaymentOption}>
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

      <div
        className={hasExpressMethods ? styles.expressCheckoutWrap : styles.expressCheckoutWrapHidden}
      >
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
            shippingAddressRequired: true,
          }}
          onReady={(event) => {
            const available = event.availablePaymentMethods;
            setHasExpressMethods(
              Boolean(available?.applePay || available?.googlePay || available?.paypal),
            );
          }}
          onShippingAddressChange={(event) => {
            if (!isSupportedCountryCode(event.address.country)) {
              event.reject();
              return;
            }

            event.resolve();
          }}
          onConfirm={handleExpressConfirm}
        />
        <div className={styles.expressCheckoutDivider}>
          <span>{usingSavedPaymentMethod ? "Or pay with your saved card" : "Or pay with card"}</span>
        </div>
      </div>

      {usingSavedPaymentMethod ? (
        <div className={styles.savedPaymentSummary}>
          <p className={styles.sectionNote}>
            Your delivery details above will be used for this saved-card payment.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.paymentElement}>
            <PaymentElement
              onReady={() => setIsPaymentElementReady(true)}
              onChange={(event) => setHasPaymentMethodSelection(Boolean(event.value.type))}
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

      <button
        type="submit"
        className={styles.payButton}
        disabled={isSubmitting || (!usingSavedPaymentMethod && !isPaymentElementReady)}
      >
        {isSubmitting ? "Processing..." : usingSavedPaymentMethod ? "Pay with saved card" : "Pay securely"}
      </button>
    </form>
  );
}

export default function CheckoutClient() {
  const [items, setItems] = useState<BasketStoredItem[]>([]);
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
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
  const [isAccountLoading, setIsAccountLoading] = useState(false);

  const tipRequest = useMemo<BasketTipInput>(() => {
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
    if (!quote) {
      return null;
    }

    return {
      amount: quote.totalCents,
      currency: quote.currency,
      mode: "payment",
      paymentMethodCreation: "manual",
      setupFutureUsage: isAuthenticated && savePaymentMethod ? "off_session" : null,
    };
  }, [isAuthenticated, quote, savePaymentMethod]);

  const tipSelectionLabel =
    tipChoice === "custom" ? "Custom tip" : tipChoice === "none" ? "No tip" : `${tipChoice}% tip`;
  const customTipPreviewCents =
    tipChoice === "custom" ? quote?.tipCents ?? 0 : parseMoneyTextToCents(customTip);
  const hasSavedAddresses = savedAddresses.length > 0;
  const selectedSavedAddress =
    selectedSavedAddressId === null
      ? null
      : savedAddresses.find((address) => address.id === selectedSavedAddressId) ?? null;

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
        const addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
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
  }, [items, tipRequest]);

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

  const updateDelivery = <K extends keyof DeliveryDetails>(key: K, value: DeliveryDetails[K]) => {
    setSelectedSavedAddressId(null);
    setDelivery((current) => ({ ...current, [key]: value }));
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

  const lines = quote?.lines ?? [];
  const shippingCents = quote?.shippingCents ?? 0;
  const tipCents = quote?.tipCents ?? 0;
  const totalCents = quote?.totalCents ?? 0;
  const stripeConfigError = stripePromise ? "" : "Stripe is not configured.";

  return (
    <section className={styles.checkout}>
      <div className={styles.columns}>
        <div className={styles.formColumn}>
          {items.length === 0 ? (
            <div className={styles.emptyState}>
              <h1>Your basket is empty</h1>
              <p>Add some cookies to your basket before heading to checkout.</p>
              <Link href="/shop" className={styles.returnLink}>
                Browse the shop
              </Link>
            </div>
          ) : (
            <>
              <section className={styles.section}>
                <h2>Contact</h2>
                <div className={styles.fieldStack}>
                  <label className={styles.field}>
                    <span>Email or mobile phone number</span>
                    <input
                      type="text"
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

              <section className={styles.section}>
                <h2>Delivery</h2>
                <div className={styles.fieldStack}>
                  {isAuthenticated && hasSavedAddresses ? (
                    <div className={styles.savedAddressPicker}>
                      <p className={styles.savedPaymentHeading}>Saved addresses</p>
                      <div className={styles.savedPaymentList}>
                        {savedAddresses.map((address) => (
                          <label key={address.id} className={styles.savedAddressOption}>
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
                        <label className={styles.savedAddressOption}>
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
                    <div className={styles.savedAddressSummary}>
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
                        <label className={styles.field}>
                          <span>First name</span>
                          <input
                            type="text"
                            value={delivery.firstName}
                            onChange={(event) => updateDelivery("firstName", event.target.value)}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Last name</span>
                          <input
                            type="text"
                            value={delivery.lastName}
                            onChange={(event) => updateDelivery("lastName", event.target.value)}
                          />
                        </label>
                      </div>

                      <label className={`${styles.field} ${styles.iconField}`}>
                        <span>Address</span>
                        <input
                          type="text"
                          value={delivery.address}
                          onChange={(event) => updateDelivery("address", event.target.value)}
                        />
                        <FiSearch />
                      </label>

                      <label className={styles.field}>
                        <span>Flat number (optional)</span>
                        <input
                          type="text"
                          value={delivery.flatNumber}
                          onChange={(event) => updateDelivery("flatNumber", event.target.value)}
                        />
                      </label>

                      <div className={styles.twoUp}>
                        <label className={styles.field}>
                          <span>City</span>
                          <input
                            type="text"
                            value={delivery.city}
                            onChange={(event) => updateDelivery("city", event.target.value)}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Postcode</span>
                          <input
                            type="text"
                            value={delivery.postcode}
                            onChange={(event) => updateDelivery("postcode", event.target.value)}
                          />
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

              <section className={styles.section}>
                <h2>Shipping method</h2>
                <div className={styles.methodCard}>
                  <span>Standard</span>
                  <strong>{formatPriceFromCents(shippingCents)}</strong>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Add tip</h2>
                <div className={styles.tipCard}>
                  <div className={styles.tipCardHeader}>
                    <div className={styles.tipIntro}>
                      <span className={styles.tipEyebrow}>Optional tip</span>
                      <p className={styles.tipTitle}>Show your support for the team at Grown Cookies</p>
                    </div>
                    <div className={styles.tipSummary}>
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

                  <div className={styles.customTipSection}>
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

              <section className={styles.section}>
                <h2>Payment</h2>
                <p className={styles.totalAmount}>
                  <strong>Total amount:</strong> {formatPriceFromCents(totalCents)}
                </p>
                <p className={styles.sectionNote}>All transactions are secure and encrypted.</p>

                {isAuthenticated && isAccountLoading ? (
                  <p className={styles.sectionNote}>Loading your saved checkout details...</p>
                ) : null}
                {isAuthenticated && accountLoadError ? <p className={styles.errorText}>{accountLoadError}</p> : null}
                {quoteError ? <p className={styles.errorText}>{quoteError}</p> : null}
                {stripeConfigError ? <p className={styles.errorText}>{stripeConfigError}</p> : null}
                {!quote && !quoteError ? (
                  <p className={styles.sectionNote}>Loading payment methods...</p>
                ) : null}
                {quote && stripeOptions && stripePromise ? (
                  <Elements stripe={stripePromise} options={stripeOptions}>
                    <PaymentElementForm
                      items={items}
                      tip={tipRequest}
                      contact={contact}
                      delivery={delivery}
                      authAccessToken={authAccessToken}
                      isAuthenticated={isAuthenticated}
                      savedPaymentMethods={savedPaymentMethods}
                      selectedSavedPaymentMethodId={selectedSavedPaymentMethodId}
                      onSelectedSavedPaymentMethodChange={setSelectedSavedPaymentMethodId}
                      savePaymentMethod={savePaymentMethod}
                      onSavePaymentMethodChange={setSavePaymentMethod}
                    />
                  </Elements>
                ) : null}
              </section>

              <div className={styles.paymentFooter}>
                <p>
                  <FiLock />
                  Secure and encrypted
                </p>
              </div>
            </>
          )}
        </div>

        <aside className={styles.summaryColumn}>
          <div className={styles.summaryInner}>
            <ul className={styles.summaryItems}>
              {lines.map((item) => (
                <li
                  key={item.slug}
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
                    <span className={styles.quantityBadge}>{item.quantity}</span>
                  </div>

                  <div className={styles.summaryCopy}>
                    <p>{item.name}</p>
                    <span>
                      {item.quantity} {item.quantity === 1 ? "cookie" : "cookies"}
                    </span>
                  </div>

                  <strong>{formatPriceFromCents(item.lineTotalCents)}</strong>
                </li>
              ))}
            </ul>

            <dl className={styles.totals}>
              <div>
                <dt>Delivery fee</dt>
                <dd>{formatPriceFromCents(shippingCents)}</dd>
              </div>
            </dl>

            <div className={styles.totalRow}>
              <span>Total price</span>
              <div>
                <small>GBP</small>
                <strong>{formatPriceFromCents(totalCents).replace("GBP ", "")}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
