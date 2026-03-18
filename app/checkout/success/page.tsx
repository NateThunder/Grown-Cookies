"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { clearBasket } from "@/lib/basket-storage";
import styles from "./page.module.css";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const paymentIntentId = searchParams.get("payment_intent");
  const paymentIntentClientSecret = searchParams.get("payment_intent_client_secret");
  const redirectStatus = searchParams.get("redirect_status");
  const isPaymentSuccessful =
    Boolean(paymentIntentId) &&
    (redirectStatus ? redirectStatus === "succeeded" : Boolean(paymentIntentClientSecret));
  const shouldClearBasket = isPaymentSuccessful && Boolean(orderId);

  useEffect(() => {
    if (shouldClearBasket) {
      clearBasket();
    }
  }, [shouldClearBasket]);

  if (!isPaymentSuccessful) {
    return (
      <main className={styles.page}>
        <section className={styles.content}>
          <p className={styles.badge}>Payment cancelled</p>
          <h1>Checkout was not completed</h1>
          <p>We didn&apos;t receive a completed payment for this order.</p>
          <div className={styles.actions}>
            <Link href="/checkout" className={styles.secondaryButton}>
              Retry checkout
            </Link>
            <Link href="/shop" className={styles.button}>
              Continue shopping
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <p className={styles.badge}>Payment complete</p>
        <h1>Thank you for your order</h1>
        <p>
          Your payment has been confirmed and we are preparing your order. A confirmation email is on
          the way.
        </p>
        <p>Order reference: {orderId ? <strong>{orderId}</strong> : "processing"}</p>
        <Link href="/shop" className={styles.button}>
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
