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
import { type Stripe as StripeSDK, loadStripe } from "@stripe/stripe-js";
import {
  BASKET_UPDATED_EVENT,
  getBasket,
} from "@/lib/basket-storage";
import {
  TIP_PRESET_OPTIONS,
  formatPriceFromCents,
  parseMoneyTextToCents,
  type BasketQuote,
  type BasketStoredItem,
  type BasketTipInput,
} from "@/lib/basket";
import GiftCardTile from "@/components/gift-card-tile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "@/components/checkout-client.module.css";

type CheckoutError = {
  message: string;
};

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
  items: BasketStoredItem[];
  contact: ContactDetails;
  delivery: DeliveryDetails;
  tip: BasketTipInput;
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

function stripeErrorText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function getOptionalAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return {};
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? "";

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
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
  const [hasExpressMethods, setHasExpressMethods] = useState(false);

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
      <div
        className={hasExpressMethods ? styles.expressCheckoutWrap : styles.expressCheckoutWrapHidden}
      >
        <p className={styles.expressCheckoutLabel}>Express checkout</p>
        <ExpressCheckoutElement
          options={{
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
            layout: {
              maxColumns: 1,
              maxRows: 3,
            },
            paymentMethodOrder: ["apple_pay", "google_pay", "paypal"],
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
          onConfirm={async (event) => {
            setIsSubmitting(true);
            const result = await confirmCurrentPayment();

            if ("error" in result) {
              event.paymentFailed({
                reason: "fail",
                message: result.error,
              });
            }

            setIsSubmitting(false);
          }}
        />
        <div className={styles.expressCheckoutDivider}>
          <span>Or pay with card</span>
        </div>
      </div>

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

export default function CheckoutClient() {
  const [items, setItems] = useState<BasketStoredItem[]>([]);
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [paymentIntentClientSecret, setPaymentIntentClientSecret] = useState("");
  const [paymentPublishableKey, setPaymentPublishableKey] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactDetails>({ email: "", phone: "" });
  const [delivery, setDelivery] = useState<DeliveryDetails>(defaultDelivery);
  const [tipChoice, setTipChoice] = useState<"none" | "custom" | (typeof TIP_PRESET_OPTIONS)[number]>("none");
  const [customTip, setCustomTip] = useState("0.00");
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isPaymentStarted, setIsPaymentStarted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [paymentError, setPaymentError] = useState("");
  const [stripePromise, setStripePromise] = useState<Promise<StripeSDK | null> | null>(null);

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

  const paymentFingerprint = useMemo(
    () =>
      JSON.stringify({
        items,
        tipRequest,
        contact,
        delivery,
      }),
    [contact, delivery, items, tipRequest],
  );

  const tipSelectionLabel =
    tipChoice === "custom" ? "Custom tip" : tipChoice === "none" ? "No tip" : `${tipChoice}% tip`;
  const customTipPreviewCents =
    tipChoice === "custom" ? quote?.tipCents ?? 0 : parseMoneyTextToCents(customTip);

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
    if (!isPaymentStarted && !paymentIntentClientSecret && !paymentPublishableKey && !orderId) {
      return;
    }

    setPaymentIntentClientSecret("");
    setPaymentPublishableKey("");
    setOrderId(null);
    setIsPaymentStarted(false);
    setStripePromise(null);
    setPaymentError("Checkout details changed. Continue to secure payment again.");
  }, [paymentFingerprint]);

  const setPresetTip = (value: Exclude<typeof tipChoice, "custom">) => {
    setTipChoice(value);
  };

  const incrementCustomTip = (delta: number) => {
    setTipChoice("custom");
    const nextCents = Math.max(0, parseMoneyTextToCents(customTip) + delta * 100);
    setCustomTip((nextCents / 100).toFixed(2));
  };

  const handleCreatePaymentIntent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0) {
      setPaymentError("Add products before checking out.");
      return;
    }

    if (!quote || quoteError) {
      setPaymentError(quoteError || "Basket totals are still loading.");
      return;
    }

    if (!contact.email.trim()) {
      setPaymentError("Enter a contact email address.");
      return;
    }

    setIsCreatingPayment(true);
    setIsPaymentStarted(false);
    setPaymentError("");

    const payload: CreatePaymentPayload = {
      items,
      contact,
      delivery,
      tip: tipRequest,
    };

    try {
      const authHeaders = await getOptionalAuthHeaders();
      const response = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
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

  const lines = quote?.lines ?? [];
  const shippingCents = quote?.shippingCents ?? 0;
  const tipCents = quote?.tipCents ?? 0;
  const totalCents = quote?.totalCents ?? 0;

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

                {quoteError ? <p className={styles.errorText}>{quoteError}</p> : null}

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
                      disabled={isCreatingPayment || isPaymentStarted || Boolean(quoteError)}
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
