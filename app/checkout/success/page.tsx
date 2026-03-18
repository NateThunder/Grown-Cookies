import Link from "next/link";
import CheckoutSuccessBasketClearer from "@/components/checkout-success-basket-clearer";
import styles from "./page.module.css";

type SearchParamValue = string | string[] | undefined;

type CheckoutSuccessPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

function getSearchParamValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const params = await searchParams;
  const orderId = getSearchParamValue(params.orderId);
  const paymentIntentId = getSearchParamValue(params.payment_intent);
  const paymentIntentClientSecret = getSearchParamValue(params.payment_intent_client_secret);
  const redirectStatus = getSearchParamValue(params.redirect_status);
  const isPaymentSuccessful =
    Boolean(paymentIntentId) &&
    (redirectStatus ? redirectStatus === "succeeded" : Boolean(paymentIntentClientSecret));
  const shouldClearBasket = isPaymentSuccessful && Boolean(orderId);

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
      <CheckoutSuccessBasketClearer shouldClearBasket={shouldClearBasket} />
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
