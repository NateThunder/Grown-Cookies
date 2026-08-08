"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  BASKET_UPDATED_EVENT,
  clearBasket,
  getBasket,
  removeBasketLine,
  setBasketLineQuantity,
} from "@/lib/basket-storage";
import {
  DISPATCH_UPDATED_EVENT,
  getDispatchSelection,
  setFulfilmentSelection,
} from "@/lib/dispatch-storage";
import { formatPriceFromCents, type BasketQuote, type BasketStoredItem } from "@/lib/basket";
import {
  BAKERY_COLLECTION_METHOD,
  BAKERY_COLLECTION_LABEL,
  UK_POSTAL_SHIPPING_LABEL,
  UK_POSTAL_SHIPPING_METHOD,
  addDaysToIsoDate,
  formatDispatchDate,
  getIsoDateWeekday,
  getLondonTodayIso,
  type DispatchSelection,
} from "@/lib/dispatch";
import { formatGiftCardAmount } from "@/lib/gift-card-amounts";
import GiftCardTile from "@/components/gift-card-tile";
import styles from "@/components/cart-client.module.css";

type CartClientProps = {
  className?: string;
  layout?: "page" | "drawer";
  showTitle?: boolean;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function getMonthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function addMonthsToIsoMonth(monthDate: string, delta: number) {
  const parsed = new Date(`${monthDate}T00:00:00Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + delta);
  return parsed.toISOString().slice(0, 10);
}

function getMonthDays(monthDate: string) {
  const monthStart = getMonthStart(monthDate);
  const firstDay = new Date(`${monthStart}T00:00:00Z`);
  const nextMonth = new Date(firstDay);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);

  const leadingDays = (getIsoDateWeekday(monthStart) + 6) % 7;
  const daysInMonth = nextMonth.getUTCDate();
  const days: Array<{ date: string; inMonth: boolean }> = [];

  for (let index = leadingDays; index > 0; index -= 1) {
    days.push({
      date: addDaysToIsoDate(monthStart, -index),
      inMonth: false,
    });
  }

  for (let day = 0; day < daysInMonth; day += 1) {
    days.push({
      date: addDaysToIsoDate(monthStart, day),
      inMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    days.push({
      date: addDaysToIsoDate(days.at(-1)?.date ?? monthStart, 1),
      inMonth: false,
    });
  }

  return days;
}

function DispatchDatePicker({
  availableDates,
  selectedDate,
  onSelect,
  purpose = "dispatch",
}: {
  availableDates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  purpose?: "dispatch" | "collection";
}) {
  const firstAvailableDate = availableDates[0] ?? getLondonTodayIso();
  const lastAvailableDate = availableDates.at(-1) ?? firstAvailableDate;
  const selectedAvailableDate = availableDates.includes(selectedDate) ? selectedDate : "";
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(selectedAvailableDate || firstAvailableDate));
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const minMonth = getMonthStart(firstAvailableDate);
  const maxMonth = getMonthStart(lastAvailableDate);
  const hasDates = availableDates.length > 0;

  useEffect(() => {
    setVisibleMonth(getMonthStart(selectedAvailableDate || firstAvailableDate));
  }, [firstAvailableDate, selectedAvailableDate]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && pickerRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className={styles.dispatchPicker} ref={pickerRef}>
      <button
        type="button"
        className={styles.dispatchDateButton}
        onClick={() => setIsOpen((current) => !current)}
        disabled={!hasDates}
        aria-expanded={isOpen}
      >
        <FiCalendar aria-hidden="true" />
        <span>{selectedAvailableDate ? formatDispatchDate(selectedAvailableDate) : `Choose a ${purpose} date`}</span>
      </button>

      {isOpen && hasDates ? (
        <div className={styles.dispatchCalendar} role="dialog" aria-label={`Choose a ${purpose} date`}>
          <div className={styles.dispatchCalendarHeader}>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonthsToIsoMonth(current, -1))}
              disabled={visibleMonth <= minMonth}
              aria-label="Previous month"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <strong>{monthFormatter.format(new Date(`${visibleMonth}T00:00:00Z`))}</strong>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonthsToIsoMonth(current, 1))}
              disabled={visibleMonth >= maxMonth}
              aria-label="Next month"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className={styles.dispatchWeekdays} aria-hidden="true">
            {WEEKDAY_LABELS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.dispatchDays}>
            {monthDays.map((day) => {
              const isAvailable = day.inMonth && availableDateSet.has(day.date);
              const isSelected = day.date === selectedAvailableDate;

              return (
                <button
                  key={day.date}
                  type="button"
                  className={[
                    styles.dispatchDay,
                    !day.inMonth ? styles.dispatchDayMuted : "",
                    isSelected ? styles.dispatchDaySelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!isAvailable}
                  onClick={() => {
                    onSelect(day.date);
                    setIsOpen(false);
                  }}
                  aria-pressed={isSelected}
                >
                  {Number.parseInt(day.date.slice(-2), 10)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CartClient({
  className = "",
  layout = "page",
  showTitle = true,
}: CartClientProps) {
  const [basketItems, setBasketItems] = useState<BasketStoredItem[]>([]);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection | null>(null);
  const [hasHydratedBasket, setHasHydratedBasket] = useState(false);
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [dispatchError, setDispatchError] = useState("");
  const cartClassName = [
    styles.cart,
    layout === "drawer" ? styles.drawerCart : styles.pageCart,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const refresh = () => setBasketItems(getBasket());
    const handleUpdate = () => refresh();

    refresh();
    setHasHydratedBasket(true);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener(BASKET_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(BASKET_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    const refresh = () =>
      setDispatchSelection(
        getDispatchSelection() ?? { method: UK_POSTAL_SHIPPING_METHOD, scheduledDate: "" },
      );
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
    if (basketItems.length === 0) {
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
            items: basketItems,
            tip: { mode: "none" },
            dispatch: dispatchSelection,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(error.error || "Could not load your basket.");
        }

        const nextQuote = (await response.json()) as BasketQuote;
        setQuote(nextQuote);
        setQuoteError("");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setQuote(null);
        setQuoteError(error instanceof Error ? error.message : "Could not load your basket.");
      }
    };

    void loadQuote();

    return () => {
      abortController.abort();
    };
  }, [basketItems, dispatchSelection]);

  const handleQuantityChange = (lineId: string, nextQuantity: number) => {
    setBasketLineQuantity(lineId, nextQuantity);
    setBasketItems(getBasket());
  };

  const handleRemove = (lineId: string) => {
    removeBasketLine(lineId);
    setBasketItems(getBasket());
  };

  const handleClearBasket = () => {
    clearBasket();
    setFulfilmentSelection(UK_POSTAL_SHIPPING_METHOD, "");
    setBasketItems(getBasket());
    setDispatchSelection({ method: UK_POSTAL_SHIPPING_METHOD, scheduledDate: "" });
    setDispatchError("");
  };

  const handleDispatchDateSelect = (date: string) => {
    const method = dispatchSelection?.method ?? UK_POSTAL_SHIPPING_METHOD;
    setFulfilmentSelection(method, date);
    setDispatchSelection({ method, scheduledDate: date });
    setDispatchError("");
  };

  const handleFulfilmentMethodChange = (method: DispatchSelection["method"]) => {
    const scheduledDate = dispatchSelection?.scheduledDate ?? "";
    setFulfilmentSelection(method, scheduledDate);
    setDispatchSelection({ method, scheduledDate });
    setDispatchError("");
  };

  const lines = quote?.lines ?? [];
  const subtotalCents = quote?.subtotalCents ?? 0;
  const hasPhysicalItems = quote
    ? lines.some((line) => !line.isGiftCard)
    : basketItems.some((item) => item.slug !== "gift-card");
  const availableDispatchDates = quote?.availableDispatchDates ?? [];
  const selectedDispatchDate = dispatchSelection?.scheduledDate ?? "";
  const selectedMethod = dispatchSelection?.method ?? UK_POSTAL_SHIPPING_METHOD;
  const isCollection = selectedMethod === BAKERY_COLLECTION_METHOD;
  const isSelectedDispatchDateValid =
    !hasPhysicalItems ||
    Boolean(selectedDispatchDate && availableDispatchDates.includes(selectedDispatchDate));
  const isQuotePending = hasHydratedBasket && basketItems.length > 0 && !quote && !quoteError;
  const subtotalLabel = quote
    ? formatPriceFromCents(subtotalCents)
    : quoteError
      ? "Unavailable"
      : "Calculating...";

  useEffect(() => {
    if (!quote || !hasPhysicalItems || !selectedDispatchDate) {
      return;
    }

    if (!availableDispatchDates.includes(selectedDispatchDate)) {
      setFulfilmentSelection(selectedMethod, "");
      setDispatchSelection({ method: selectedMethod, scheduledDate: "" });
      setDispatchError("That date is no longer available. Choose a new date.");
    }
  }, [availableDispatchDates, hasPhysicalItems, quote, selectedDispatchDate, selectedMethod]);

  const handleCheckout = () => {
    if (!quote || quoteError) {
      return;
    }

    if (!isSelectedDispatchDateValid) {
      setDispatchError(`Choose a ${isCollection ? "collection" : "dispatch"} date before checkout.`);
      return;
    }

    window.location.href = "/checkout";
  };

  return (
    <section className={cartClassName}>
      {showTitle ? <h1>Your basket</h1> : null}

      {!hasHydratedBasket ? (
        <div className={`${styles.loadingState} whiteFrame`}>
          <p>Loading your basket...</p>
        </div>
      ) : basketItems.length === 0 ? (
        <div className={`${styles.emptyState} whiteFrame`}>
          <p>Your basket is empty</p>
          <Link href="/shop" className={styles.shopLink}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          {quoteError ? <p className={styles.itemPrice}>{quoteError}</p> : null}

          {isQuotePending ? (
            <div className={`${styles.loadingState} whiteFrame`}>
              <p>Loading basket totals...</p>
            </div>
          ) : (
            <ul className={styles.itemList}>
              {lines.map((item) => (
                <li key={item.lineId} className={`${styles.item} whiteFrame`}>
                  <div
                    className={`${styles.itemImageWrap} ${
                      item.isGiftCard ? styles.itemImageWrapGiftCard : ""
                    }`}
                  >
                    {item.image ? (
                      item.isGiftCard ? (
                        <GiftCardTile
                          src={item.image}
                          alt={item.imageAlt ?? item.name}
                          className={styles.itemGiftCardTile}
                        />
                      ) : (
                        <Image
                          src={item.image}
                          alt={item.imageAlt ?? item.name}
                          fill
                          className={styles.itemImage}
                        />
                      )
                    ) : (
                      <span className={styles.itemImagePlaceholder}>No image</span>
                    )}
                  </div>

                  <div className={styles.itemBody}>
                    <div className={styles.itemCopy}>
                      <h2>{item.name}</h2>
                      <p className={styles.itemPrice}>
                        {item.isGiftCard
                          ? `Gift card value: ${formatGiftCardAmount(item.unitPriceCents)}`
                          : formatPriceFromCents(item.unitPriceCents)}
                      </p>
                      {item.gifting ? (
                        <div className={styles.itemGifting}>
                          <p>
                            Gift: {item.gifting.cardLabel}
                            {item.gifting.cardPriceCents > 0
                              ? ` (+${formatPriceFromCents(item.gifting.cardPriceCents)})`
                              : " (included)"}
                          </p>
                          {item.gifting.message ? <p>Message: {item.gifting.message}</p> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.itemActions}>
                      {item.isGiftCard ? (
                        <button
                          type="button"
                          className={styles.giftCardRemoveButton}
                          aria-label={`Remove ${item.name}`}
                          onClick={() => handleRemove(item.lineId)}
                        >
                          Remove
                        </button>
                      ) : (
                        <div className={styles.controlGroup}>
                          <button
                            type="button"
                            className={`${styles.controlButton} ${styles.quantityButton}`.trim()}
                            aria-label={`Decrease ${item.name}`}
                            disabled={item.quantity <= 1}
                            onClick={() => handleQuantityChange(item.lineId, item.quantity - 1)}
                          >
                            -
                          </button>

                          <span className={styles.controlValue}>{item.quantity}</span>

                          <button
                            type="button"
                            className={`${styles.controlButton} ${styles.quantityButton}`.trim()}
                            aria-label={`Increase ${item.name}`}
                            onClick={() => handleQuantityChange(item.lineId, item.quantity + 1)}
                          >
                            +
                          </button>

                          <button
                            type="button"
                            className={`${styles.controlButton} ${styles.removeButton}`.trim()}
                            aria-label={`Remove ${item.name}`}
                            onClick={() => handleRemove(item.lineId)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <section className={styles.summary}>
            <div className={styles.summaryFooter}>
              <p className={styles.summaryFooterRow}>
                <span>Subtotal</span>
                <strong>{subtotalLabel}</strong>
              </p>

              {quote && !quoteError && hasPhysicalItems ? (
                <>
                  <fieldset className={styles.fulfilmentOptions}>
                    <legend>How would you like your order?</legend>
                    <label className={selectedMethod === UK_POSTAL_SHIPPING_METHOD ? styles.fulfilmentOptionActive : styles.fulfilmentOption}>
                      <input
                        type="radio"
                        name={`basket-fulfilment-${layout}`}
                        value={UK_POSTAL_SHIPPING_METHOD}
                        checked={selectedMethod === UK_POSTAL_SHIPPING_METHOD}
                        onChange={() => handleFulfilmentMethodChange(UK_POSTAL_SHIPPING_METHOD)}
                      />
                      <span>Delivery</span>
                    </label>
                    <label className={isCollection ? styles.fulfilmentOptionActive : styles.fulfilmentOption}>
                      <input
                        type="radio"
                        name={`basket-fulfilment-${layout}`}
                        value={BAKERY_COLLECTION_METHOD}
                        checked={isCollection}
                        onChange={() => handleFulfilmentMethodChange(BAKERY_COLLECTION_METHOD)}
                      />
                      <span>Collection</span>
                    </label>
                  </fieldset>
                  <div className={styles.dispatchIntro}>
                    <h2 className={styles.dispatchHeading}>
                      {isCollection ? BAKERY_COLLECTION_LABEL : UK_POSTAL_SHIPPING_LABEL}
                    </h2>
                    <p className={styles.dispatchCopy}>
                      {isCollection
                        ? "Choose your collection date. Your order will be ready between 12:00 and 15:00."
                        : "Choose your dispatch date so we know when to bake and post your cookies."}
                    </p>
                  </div>

                  <DispatchDatePicker
                    availableDates={availableDispatchDates}
                    selectedDate={selectedDispatchDate}
                    onSelect={handleDispatchDateSelect}
                    purpose={isCollection ? "collection" : "dispatch"}
                  />
                  {isCollection && quote.collection ? (
                    <address className={styles.collectionAddress}>
                      <strong>{quote.collection.venue}</strong>
                      <span>{quote.collection.addressLine1}</span>
                      <span>{quote.collection.city}, {quote.collection.postcode}</span>
                      <span>{quote.collection.windowStart}–{quote.collection.windowEnd}</span>
                    </address>
                  ) : null}
                  <p className={styles.dispatchCopy}>
                    Bank holidays in England, Wales, and Scotland are unavailable.
                  </p>
                  {dispatchError ? <p className={styles.dispatchError}>{dispatchError}</p> : null}
                </>
              ) : null}

              {quote && !quoteError && !hasPhysicalItems ? (
                <p className={styles.dispatchCopy}>Your gift card code will be delivered by email.</p>
              ) : null}

              {quote && !quoteError ? (
                <button type="button" className={styles.checkoutButton} onClick={handleCheckout}>
                  Continue to checkout
                </button>
              ) : null}

              <button type="button" onClick={handleClearBasket} className={styles.clearAllButton}>
                Clear Basket
              </button>

              <Link href="/shop" className={styles.continueShoppingButton}>
                Continue shopping
              </Link>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
