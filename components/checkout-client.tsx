"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiLock, FiMinus, FiPlus, FiSearch } from "react-icons/fi";
import {
  BASKET_UPDATED_EVENT,
  formatPrice,
  getBasket,
  getBasketSubtotal,
  parsePrice,
  type BasketItem,
} from "@/lib/basket-storage";
import styles from "@/components/checkout-client.module.css";

const shippingCost = 10;

const expressOptions = [
  { label: "shop", className: styles.shopPayButton },
  { label: "PayPal", className: styles.paypalButton },
  { label: "G Pay", className: styles.gpayButton },
];

const paymentOptions = [
  { id: "card", label: "Credit card", detail: "Visa, Mastercard, Amex" },
  { id: "klarna", label: "Klarna", detail: "Pay later in 3 interest-free payments" },
  { id: "shop-pay", label: "Shop Pay", detail: "Pay in full or in installments" },
  { id: "paypal", label: "PayPal", detail: "Fast checkout with your PayPal account" },
];

type TipChoice = 0 | 10 | 15 | 20;

export default function CheckoutClient() {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [tipChoice, setTipChoice] = useState<TipChoice>(0);
  const [customTip, setCustomTip] = useState("0");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

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

  const subtotal = useMemo(() => getBasketSubtotal(items), [items]);
  const quantity = useMemo(
    () => items.reduce((count, item) => count + item.quantity, 0),
    [items],
  );

  const computedTip = useMemo(() => {
    if (tipChoice !== 0) {
      return subtotal * (tipChoice / 100);
    }

    return Math.max(0, parsePrice(customTip));
  }, [customTip, subtotal, tipChoice]);

  const total = subtotal + (items.length > 0 ? shippingCost : 0) + computedTip;

  const setPresetTip = (value: TipChoice) => {
    setTipChoice(value);
    if (value !== 0) {
      setCustomTip("0");
    }
  };

  const incrementCustomTip = (delta: number) => {
    setTipChoice(0);
    const next = Math.max(0, parsePrice(customTip) + delta);
    setCustomTip(next.toFixed(2));
  };

  return (
    <section className={styles.checkout}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Grown Cookies home">
          grown
          <br />
          cookies
        </Link>
      </header>

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
                <p className={styles.expressLabel}>Express checkout</p>
                <div className={styles.expressRow}>
                  {expressOptions.map((option) => (
                    <button key={option.label} type="button" className={option.className}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className={styles.divider}>
                  <span>OR</span>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Contact</h2>
                <div className={styles.fieldStack}>
                  <label className={styles.field}>
                    <span>Email or mobile phone number</span>
                    <input type="text" defaultValue="garret.heaney@example.com" />
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
                    <select defaultValue="United Kingdom">
                      <option>United Kingdom</option>
                      <option>United States</option>
                      <option>Canada</option>
                    </select>
                    <FiChevronDown />
                  </label>

                  <div className={styles.twoUp}>
                    <label className={styles.field}>
                      <span>First name (optional)</span>
                      <input type="text" defaultValue="Garret" />
                    </label>
                    <label className={styles.field}>
                      <span>Last name</span>
                      <input type="text" defaultValue="Heaney" />
                    </label>
                  </div>

                  <label className={`${styles.field} ${styles.iconField}`}>
                    <span>Address</span>
                    <input type="text" defaultValue="96 Euston Road" />
                    <FiSearch />
                  </label>

                  <label className={styles.field}>
                    <span>Apartment, suite, etc. (optional)</span>
                    <input type="text" placeholder="" />
                  </label>

                  <div className={styles.twoUp}>
                    <label className={styles.field}>
                      <span>City</span>
                      <input type="text" defaultValue="London" />
                    </label>
                    <label className={styles.field}>
                      <span>Postcode</span>
                      <input type="text" defaultValue="NW1 2DB" />
                    </label>
                  </div>

                  <label className={`${styles.field} ${styles.iconField}`}>
                    <span>Phone (optional)</span>
                    <input type="text" defaultValue="+44 330 333 1144" />
                    <span className={styles.flag}>GB</span>
                  </label>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Shipping method</h2>
                <div className={styles.methodCard}>
                  <span>Standard</span>
                  <strong>{formatPrice(shippingCost)}</strong>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Payment</h2>
                <p className={styles.sectionNote}>All transactions are secure and encrypted.</p>

                <div className={styles.paymentList}>
                  {paymentOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`${styles.paymentOption} ${
                        paymentMethod === option.id ? styles.paymentOptionActive : ""
                      }`.trim()}
                    >
                      <div className={styles.paymentHeading}>
                        <input
                          type="radio"
                          name="payment-method"
                          checked={paymentMethod === option.id}
                          onChange={() => setPaymentMethod(option.id)}
                        />
                        <span>{option.label}</span>
                      </div>
                      <span className={styles.paymentDetail}>{option.detail}</span>
                    </label>
                  ))}
                </div>

                {paymentMethod === "card" ? (
                  <div className={styles.cardFields}>
                    <label className={`${styles.field} ${styles.iconField}`}>
                      <span>Card number</span>
                      <input type="text" placeholder="1234 1234 1234 1234" />
                      <FiLock />
                    </label>
                    <div className={styles.twoUp}>
                      <label className={styles.field}>
                        <span>Expiration date (MM / YY)</span>
                        <input type="text" placeholder="MM / YY" />
                      </label>
                      <label className={styles.field}>
                        <span>Security code</span>
                        <input type="text" placeholder="CVC" />
                      </label>
                    </div>
                    <label className={styles.field}>
                      <span>Name on card</span>
                      <input type="text" defaultValue="Garret Heaney" />
                    </label>
                    <label className={styles.checkboxRow}>
                      <input type="checkbox" defaultChecked />
                      <span>Use shipping address as billing address</span>
                    </label>
                  </div>
                ) : null}
              </section>

              <section className={styles.section}>
                <h2>Add tip</h2>
                <div className={styles.tipCard}>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked readOnly />
                    <span>Show your support for the team at Grown Cookies</span>
                  </label>

                  <div className={styles.tipGrid}>
                    {[10, 15, 20].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={tipChoice === value ? styles.tipButtonActive : styles.tipButton}
                        onClick={() => setPresetTip(value as TipChoice)}
                      >
                        <strong>{value}%</strong>
                        <span>{formatPrice(subtotal * (value / 100))}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={tipChoice === 0 ? styles.tipButtonActive : styles.tipButton}
                      onClick={() => setPresetTip(0)}
                    >
                      <strong>None</strong>
                      <span>{formatPrice(parsePrice(customTip))}</span>
                    </button>
                  </div>

                  <div className={styles.customTipRow}>
                    <label className={styles.field}>
                      <span>Custom tip</span>
                      <input
                        type="text"
                        value={customTip}
                        onChange={(event) => {
                          setTipChoice(0);
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

                  <p className={styles.tipMessage}>Thank you, we appreciate it.</p>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Remember me</h2>
                <label className={styles.rememberCard}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Save my information for a faster checkout</span>
                </label>
              </section>

              <div className={styles.paymentFooter}>
                <p>
                  <FiLock />
                  Secure and encrypted
                </p>
                <span className={styles.footerBrand}>shop</span>
              </div>

              <button type="button" className={styles.payButton}>
                Pay now
              </button>
            </>
          )}
        </div>

        <aside className={styles.summaryColumn}>
          <div className={styles.summaryInner}>
            <ul className={styles.summaryItems}>
              {items.map((item) => (
                <li key={item.slug} className={styles.summaryItem}>
                  <div className={styles.summaryImageWrap}>
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.imageAlt ?? item.name}
                        fill
                        className={styles.summaryImage}
                      />
                    ) : (
                      <span className={styles.summaryPlaceholder}>No image</span>
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
              ))}
            </ul>

            <dl className={styles.totals}>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>{items.length > 0 ? formatPrice(shippingCost) : formatPrice(0)}</dd>
              </div>
              <div>
                <dt>Tip</dt>
                <dd>{formatPrice(computedTip)}</dd>
              </div>
            </dl>

            <div className={styles.totalRow}>
              <span>Total</span>
              <div>
                <small>GBP</small>
                <strong>{formatPrice(total).replace("GBP ", "")}</strong>
              </div>
            </div>

            <p className={styles.summaryMeta}>
              {quantity} {quantity === 1 ? "item" : "items"} in your order
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
