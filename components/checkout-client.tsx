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
  type Stripe as StripeSDK,
  type StripeExpressCheckoutElementConfirmEvent,
  loadStripe,
} from "@stripe/stripe-js";
import {
  BASKET_UPDATED_EVENT,
  formatPrice,
  getBasket,
  getBasketSubtotal,
  parsePrice,
  type BasketItem,
} from "@/lib/basket-storage";
import GiftCardTile from "@/components/gift-card-tile";
import styles from "@/components/checkout-client.module.css";

type CheckoutError = {
  message: string;
};

const TIP_PRESET_OPTIONS = [10, 15, 20] as const;

type TipChoice = "none" | "custom" | (typeof TIP_PRESET_OPTIONS)[number];

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

type CreatePaymentPayload = {
  items: Array<{ slug: string; quantity: number }>;
  contact: ContactDetails;
  delivery: DeliveryDetails;
  tipCents: number;
};

const defaultDelivery = {
  firstName: "",
  lastName: "",
  address: "",
  flatNumber: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
};

type PaymentIntentResponse = {
  clientSecret?: string;
  publishableKey?: string;
  orderId?: string;
  totalCents?: number;
};

type ExpressPaymentResponse = {
  clientSecret?: string;
  orderId?: string;
  paymentIntentId?: string;
  status?: string;
};

const EXPRESS_CHECKOUT_ALLOWED_COUNTRIES = ["GB", "US", "CA"] as const;
const STRIPE_CHECKOUT_CURRENCY = "gbp";

function toMoneyCents(value: number) {
  return Math.max(0, Math.round(value * 100));
}

function stripeErrorText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function buildCheckoutSuccessUrl(params: {
  orderId: string;
  paymentIntentId: string;
  paymentIntentClientSecret?: string | null;
}) {
  const searchParams = new URLSearchParams({
    orderId: params.orderId,
    payment_intent: params.paymentIntentId,
  });

  if (params.paymentIntentClientSecret) {
    searchParams.set("payment_intent_client_secret", params.paymentIntentClientSecret);
  }

  return `/checkout/success?${searchParams.toString()}`;
}

function ExpressCheckoutShortcut({
  items,
  shippingCents,
  tipCents,
  onError,
}: {
  items: BasketItem[];
  shippingCents: number;
  tipCents: number;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [hasExpressMethods, setHasExpressMethods] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shippingRate = useMemo(
    () => ({
      id: "standard-shipping",
      displayName: "Standard delivery",
      amount: shippingCents,
    }),
    [shippingCents],
  );

  const lineItems = useMemo(
    () => [
      ...items.map((item) => ({
        name: `${item.name} x${item.quantity}`,
        amount: toMoneyCents(parsePrice(item.price) * item.quantity),
      })),
      {
        name: "Standard delivery",
        amount: shippingCents,
      },
      ...(tipCents > 0
        ? [
            {
              name: "Tip",
              amount: tipCents,
            },
          ]
        : []),
    ],
    [items, shippingCents, tipCents],
  );

  const handleExpressConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements || isSubmitting) {
      const errorMessage = "Express checkout is still loading. Please wait.";
      onError(errorMessage);
      event.paymentFailed({
        reason: "fail",
        message: errorMessage,
      });
      return;
    }

    setIsSubmitting(true);
    onError("");

    try {
      const confirmationResult = await stripe.createConfirmationToken({
        elements,
      });

      if (confirmationResult.error || !confirmationResult.confirmationToken?.id) {
        throw new Error(stripeErrorText(confirmationResult.error));
      }

      const response = await fetch("/api/stripe/express-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            slug: item.slug,
            quantity: item.quantity,
          })),
          tipCents,
          confirmationTokenId: confirmationResult.confirmationToken.id,
          returnUrlBase: window.location.origin,
          fallbackContact: {
            email: event.billingDetails?.email ?? "",
            phone: event.billingDetails?.phone ?? "",
          },
        }),
      });

      const result = (await response.json().catch(() => ({}))) as ExpressPaymentResponse & {
        error?: string;
      };

      if (!response.ok || !result.clientSecret || !result.orderId || !result.paymentIntentId) {
        throw new Error(result.error || "Could not complete express checkout.");
      }

      if (result.status === "requires_action") {
        const nextActionResult = await stripe.handleNextAction({
          clientSecret: result.clientSecret,
        });

        if (nextActionResult.error) {
          throw new Error(stripeErrorText(nextActionResult.error));
        }

        if ("paymentIntent" in nextActionResult && nextActionResult.paymentIntent?.id) {
          window.location.href = buildCheckoutSuccessUrl({
            orderId: result.orderId,
            paymentIntentId: nextActionResult.paymentIntent.id,
            paymentIntentClientSecret:
              nextActionResult.paymentIntent.client_secret ?? result.clientSecret,
          });
          return;
        }

        throw new Error("Could not complete express checkout.");
      }

      if (
        result.status === "succeeded" ||
        result.status === "processing" ||
        result.status === "requires_capture"
      ) {
        window.location.href = buildCheckoutSuccessUrl({
          orderId: result.orderId,
          paymentIntentId: result.paymentIntentId,
          paymentIntentClientSecret: result.clientSecret,
        });
        return;
      }

      throw new Error("Could not complete express checkout.");
    } catch (error) {
      const errorMessage = stripeErrorText(error);
      onError(errorMessage);
      event.paymentFailed({
        reason: "fail",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={hasExpressMethods ? styles.expressCheckoutWrap : styles.expressCheckoutWrapHidden}
    >
      <p className={styles.expressCheckoutLabel}>Express checkout</p>
      <ExpressCheckoutElement
        options={{
          allowedShippingCountries: [...EXPRESS_CHECKOUT_ALLOWED_COUNTRIES],
          emailRequired: true,
          lineItems,
          phoneNumberRequired: false,
          shippingAddressRequired: true,
          shippingRates: [shippingRate],
          buttonTheme: {
            applePay: "black",
            googlePay: "black",
          },
          buttonType: {
            applePay: "check-out",
            googlePay: "checkout",
            paypal: "buynow",
          },
          layout: {
            maxColumns: 2,
            maxRows: 1,
            overflow: "never",
          },
          paymentMethods: {
            applePay: "auto",
            googlePay: "auto",
            link: "never",
            paypal: "auto",
            amazonPay: "never",
          },
        }}
        onReady={(event) => {
          const available = event.availablePaymentMethods;
          setHasExpressMethods(
            Boolean(available?.applePay || available?.googlePay || available?.paypal),
          );
        }}
        onShippingAddressChange={(event) => {
          const country = event.address.country?.toUpperCase() ?? "";
          if (
            country &&
            !EXPRESS_CHECKOUT_ALLOWED_COUNTRIES.some((allowedCountry) => allowedCountry === country)
          ) {
            event.reject();
            return;
          }

          event.resolve({
            lineItems,
            shippingRates: [shippingRate],
          });
        }}
        onShippingRateChange={(event) => {
          event.resolve({
            lineItems,
            shippingRates: [shippingRate],
          });
        }}
        onConfirm={handleExpressConfirm}
      />
      <div className={styles.expressCheckoutDivider}>
        <span>Or pay with card</span>
      </div>
    </div>
  );
}

function PaymentElementForm({
  orderId,
  onError,
}: {
  orderId: string;
  onError: (error: CheckoutError | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const confirmCurrentPayment = async () => {
    if (!stripe || !elements) {
      const errorMessage = "Payment form is still loading. Please wait.";
      setLocalError(errorMessage);
      onError({ message: errorMessage });
      return { error: errorMessage };
    }

    setLocalError("");
    onError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?orderId=${orderId}`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      const errorMessage = stripeErrorText(result.error);
      setLocalError(errorMessage);
      onError({ message: errorMessage });
      return { error: errorMessage };
    }

    if (result.paymentIntent?.status === "succeeded" && result.paymentIntent.id) {
      window.location.href = `/checkout/success?orderId=${orderId}&payment_intent=${result.paymentIntent.id}&payment_intent_client_secret=${result.paymentIntent.client_secret ?? ""}`;
      return { success: true };
    }

    return { success: true };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    await confirmCurrentPayment();
    setIsSubmitting(false);
  };

  return (
    <form className={styles.stripeForm} onSubmit={handleSubmit}>
      <div className={styles.paymentElement}>
        <PaymentElement />
      </div>

      {localError ? <p className={styles.errorText}>{localError}</p> : null}

      <button type="submit" className={styles.payButton} disabled={isSubmitting}>
        {isSubmitting ? "Processing..." : "Pay securely"}
      </button>
    </form>
  );
}

export default function CheckoutClient({ shippingCents }: { shippingCents: number }) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [paymentIntentClientSecret, setPaymentIntentClientSecret] = useState("");
  const [paymentPublishableKey, setPaymentPublishableKey] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactDetails>({ email: "", phone: "" });
  const [delivery, setDelivery] = useState<DeliveryDetails>(defaultDelivery);
  const [tipChoice, setTipChoice] = useState<TipChoice>("none");
  const [customTip, setCustomTip] = useState("0.00");
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isPaymentStarted, setIsPaymentStarted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [paymentError, setPaymentError] = useState("");

  const [stripePromise, setStripePromise] = useState<Promise<StripeSDK | null> | null>(null);
  const expressStripePromise = useMemo(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    return publishableKey ? loadStripe(publishableKey) : null;
  }, []);

  const subtotal = useMemo(() => getBasketSubtotal(items), [items]);
  const subtotalCents = useMemo(() => toMoneyCents(subtotal), [subtotal]);
  const parsedCustomTipCents = useMemo(
    () => Math.max(0, Math.round(parsePrice(customTip) * 100)),
    [customTip],
  );

  const computedTipCents = useMemo(() => {
    if (tipChoice === "custom") {
      return parsedCustomTipCents;
    }

    if (tipChoice === "none") {
      return 0;
    }

    return Math.round(subtotalCents * (tipChoice / 100));
  }, [subtotalCents, tipChoice, parsedCustomTipCents]);
  const totalCents = subtotalCents + shippingCents + computedTipCents;
  const total = totalCents / 100;
  const tipSelectionLabel =
    tipChoice === "custom" ? "Custom tip" : tipChoice === "none" ? "No tip" : `${tipChoice}% tip`;

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

  const setPresetTip = (value: Exclude<TipChoice, "custom">) => {
    setTipChoice(value);
  };

  const incrementCustomTip = (delta: number) => {
    setTipChoice("custom");
    const next = Math.max(0, parsePrice(customTip) + delta);
    setCustomTip(next.toFixed(2));
  };

  const handleCreatePaymentIntent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0) {
      setPaymentError("Add products before checking out.");
      return;
    }

    if (!contact.email.trim()) {
      setPaymentError("Enter a contact email or phone number.");
      return;
    }

    setIsCreatingPayment(true);
    setIsPaymentStarted(false);
    setPaymentError("");

    const payload: CreatePaymentPayload = {
      items: items.map((item) => ({
        slug: item.slug,
        quantity: item.quantity,
      })),
      contact,
      delivery,
      tipCents: computedTipCents,
    };

    try {
      const response = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || "Could not initialize payment.");
      }

      const result = (await response.json()) as PaymentIntentResponse;
      if (!result.clientSecret || !result.publishableKey || !result.orderId) {
        throw new Error("Could not initialize payment.");
      }

      setPaymentError("");
      setPaymentIntentClientSecret(result.clientSecret);
      setPaymentPublishableKey(result.publishableKey);
      setOrderId(result.orderId);
      setIsPaymentStarted(true);
      setStripePromise(loadStripe(result.publishableKey));
    } catch (error) {
      setPaymentError(stripeErrorText(error));
    } finally {
      setIsCreatingPayment(false);
    }
  };

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
                  <label className={`${styles.field} ${styles.selectField}`}>
                    <span>Country/Region</span>
                    <select
                      value={delivery.country}
                      onChange={(event) =>
                        setDelivery((prev) => ({ ...prev, country: event.target.value }))
                      }
                    >
                      <option>United Kingdom</option>
                      <option>United States</option>
                      <option>Canada</option>
                    </select>
                    <FiChevronDown />
                  </label>

                  <div className={styles.twoUp}>
                    <label className={styles.field}>
                      <span>First name</span>
                      <input
                        type="text"
                        value={delivery.firstName}
                        onChange={(event) =>
                          setDelivery((prev) => ({ ...prev, firstName: event.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Last name</span>
                      <input
                        type="text"
                        value={delivery.lastName}
                        onChange={(event) =>
                          setDelivery((prev) => ({ ...prev, lastName: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <label className={`${styles.field} ${styles.iconField}`}>
                    <span>Address</span>
                    <input
                      type="text"
                      value={delivery.address}
                      onChange={(event) =>
                        setDelivery((prev) => ({ ...prev, address: event.target.value }))
                      }
                    />
                    <FiSearch />
                  </label>

                  <label className={styles.field}>
                    <span>Flat number (optional)</span>
                    <input
                      type="text"
                      value={delivery.flatNumber}
                      onChange={(event) =>
                        setDelivery((prev) => ({ ...prev, flatNumber: event.target.value }))
                      }
                    />
                  </label>

                  <div className={styles.twoUp}>
                    <label className={styles.field}>
                      <span>City</span>
                      <input
                        type="text"
                        value={delivery.city}
                        onChange={(event) =>
                          setDelivery((prev) => ({ ...prev, city: event.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Postcode</span>
                      <input
                        type="text"
                        value={delivery.postcode}
                        onChange={(event) =>
                          setDelivery((prev) => ({ ...prev, postcode: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <label className={`${styles.field} ${styles.iconField}`}>
                    <span>Phone (optional)</span>
                    <input
                      type="text"
                      value={contact.phone}
                      onChange={(event) =>
                        setContact((prev) => ({ ...prev, phone: event.target.value }))
                      }
                    />
                    <span className={styles.flag}>GB</span>
                  </label>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Shipping method</h2>
                <div className={styles.methodCard}>
                  <span>Standard</span>
                  <strong>{formatPrice(shippingCents / 100)}</strong>
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
                      <strong>{formatPrice(computedTipCents / 100)}</strong>
                    </div>
                  </div>

                  <div className={styles.tipGrid}>
                    {TIP_PRESET_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={tipChoice === value ? styles.tipButtonActive : styles.tipButton}
                        onClick={() => setPresetTip(value)}
                      >
                        <strong>{value}%</strong>
                        <span>{formatPrice(subtotal * (value / 100))}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={tipChoice === "none" ? styles.tipButtonActive : styles.tipButton}
                      onClick={() => setPresetTip("none")}
                    >
                      <strong>None</strong>
                      <span>{formatPrice(0)}</span>
                    </button>
                  </div>

                  <div className={styles.customTipSection}>
                    <div className={styles.customTipHeader}>
                      <span>Custom tip</span>
                      <strong>{formatPrice(parsedCustomTipCents / 100)}</strong>
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
                  <strong>Total amount:</strong> {formatPrice(total)}
                </p>
                <p className={styles.sectionNote}>All transactions are secure and encrypted.</p>

                {expressStripePromise ? (
                  <Elements
                    key={`express-${totalCents}-${computedTipCents}-${items
                      .map((item) => `${item.slug}:${item.quantity}`)
                      .join(",")}`}
                    stripe={expressStripePromise}
                    options={{
                      amount: totalCents,
                      currency: STRIPE_CHECKOUT_CURRENCY,
                      mode: "payment",
                    }}
                  >
                    <ExpressCheckoutShortcut
                      items={items}
                      shippingCents={shippingCents}
                      tipCents={computedTipCents}
                      onError={setPaymentError}
                    />
                  </Elements>
                ) : null}

                {isPaymentStarted && paymentIntentClientSecret && paymentPublishableKey && orderId ? (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret: paymentIntentClientSecret,
                    }}
                  >
                    <PaymentElementForm
                      orderId={orderId}
                      onError={(error) => setPaymentError(error ? error.message : "")}
                    />
                  </Elements>
                ) : (
                  <form className={styles.section} onSubmit={handleCreatePaymentIntent}>
                    {paymentError ? <p className={styles.errorText}>{paymentError}</p> : null}
                    <button
                      type="submit"
                      className={styles.payButton}
                      disabled={isCreatingPayment || isPaymentStarted}
                    >
                      {isCreatingPayment ? "Preparing payment..." : "Continue to secure payment"}
                    </button>
                  </form>
                  )}
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
              {items.map((item) => {
                const isGiftCard =
                  item.isGiftCard || item.slug === "gift-card" || /gift card/i.test(item.name);

                return (
                    <li
                      key={item.slug}
                      className={`${styles.summaryItem} ${isGiftCard ? styles.summaryItemGiftCard : ""}`}
                    >
                    <div
                      className={`${styles.summaryImageWrap} ${
                        isGiftCard ? styles.summaryImageWrapGiftCard : ""
                      }`}
                    >
                      {item.image ? (
                        isGiftCard ? (
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

                    <strong>{formatPrice(parsePrice(item.price) * item.quantity)}</strong>
                  </li>
                );
              })}
            </ul>

            <dl className={styles.totals}>
              <div>
                <dt>Delivery fee</dt>
                <dd>{formatPrice(shippingCents / 100)}</dd>
              </div>
            </dl>

            <div className={styles.totalRow}>
              <span>Total price</span>
              <div>
                <small>GBP</small>
                <strong>{formatPrice(total).replace("GBP ", "")}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
