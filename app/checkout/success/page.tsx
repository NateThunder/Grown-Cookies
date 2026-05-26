import Link from "next/link";
import SiteHeader from "@/components/site-header";
import CheckoutSuccessBasketClearer from "@/components/checkout-success-basket-clearer";
import { ensurePaidOrderEmails, isOrderNotificationEmailConfigured } from "@/lib/order-notifications";
import { getStripeClient } from "@/lib/stripe-customer-payment-methods";
import { STRIPE_CHECKOUT_ORDER_STATUS, updateOrderStatusByIdentifiers } from "@/lib/stripe-checkout";
import styles from "./page.module.css";

export const runtime = "nodejs";

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

async function reconcileOrderConfirmationEmail(orderId: string | null, paymentIntentId: string | null) {
  if (!orderId || !paymentIntentId) {
    return false;
  }

  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const paymentIntentOrderId = typeof paymentIntent.metadata?.orderId === "string"
      ? paymentIntent.metadata.orderId.trim()
      : "";

    if (paymentIntent.status !== "succeeded" || paymentIntentOrderId !== orderId) {
      return false;
    }

    await updateOrderStatusByIdentifiers({
      orderPublicId: orderId,
      paymentIntentId,
      status: STRIPE_CHECKOUT_ORDER_STATUS.paid,
    });
    await ensurePaidOrderEmails(orderId);
    return true;
  } catch (error) {
    console.error("[checkout.success] Failed to reconcile confirmation email.", {
      orderId,
      paymentIntentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const params = await searchParams;
  const orderId = getSearchParamValue(params.orderId);
  const paymentIntentId = getSearchParamValue(params.payment_intent);
  const paymentIntentClientSecret = getSearchParamValue(params.payment_intent_client_secret);
  const redirectStatus = getSearchParamValue(params.redirect_status);
  const giftCardOrder = getSearchParamValue(params.gift_card_order) === "true";
  const isPaymentSuccessful =
    giftCardOrder ||
    (Boolean(paymentIntentId) &&
      (redirectStatus ? redirectStatus === "succeeded" : Boolean(paymentIntentClientSecret)));
  const shouldClearBasket = isPaymentSuccessful && Boolean(orderId);
  const confirmationEmailTriggered = isPaymentSuccessful
    ? giftCardOrder
      ? false
      : await reconcileOrderConfirmationEmail(orderId, paymentIntentId)
    : false;

  if (!isPaymentSuccessful) {
    return (
      <main className={styles.page}>
        <SiteHeader variant="hero" showAnnouncement={false} />
        <section className={`${styles.content} whiteFrame`}>
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
      <SiteHeader variant="hero" showAnnouncement={false} />
      <CheckoutSuccessBasketClearer shouldClearBasket={shouldClearBasket} />
      <section className={`${styles.content} whiteFrame`}>
        <p className={styles.badge}>{giftCardOrder ? "Order complete" : "Payment complete"}</p>
        <h1>Thank you for your order</h1>
        <p>
          {giftCardOrder
            ? "Your gift card balance has been applied and we are preparing your order."
            : "Your payment has been confirmed and we are preparing your order."}
        </p>
        <p>
          {confirmationEmailTriggered || isOrderNotificationEmailConfigured()
            ? "We will send your confirmation by email shortly."
            : "Email confirmation is not currently available. If you need help with this order, contact orders@growncookies.co.uk."}
        </p>
        <p>Order reference: {orderId ? <strong>{orderId}</strong> : "processing"}</p>
        <Link href="/shop" className={styles.button}>
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
