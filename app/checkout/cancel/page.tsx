"use client";

import Link from "next/link";
import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export default function CheckoutCancelPage() {
  return (
    <main className={styles.page}>
      <SiteHeader variant="hero" showAnnouncement={false} />
      <section className={styles.content}>
        <p className={styles.badge}>Payment cancelled</p>
        <h1>Checkout was not completed</h1>
        <p>
          Your basket is still waiting for you. You can continue shopping or try again to complete
          payment.
        </p>
        <div className={styles.actions}>
          <Link href="/checkout" className={styles.secondaryButton}>
            Back to checkout
          </Link>
          <Link href="/shop" className={styles.button}>
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
