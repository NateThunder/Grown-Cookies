import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  ensurePaidOrderEmails,
} from "@/lib/order-notifications";
import {
  STRIPE_CHECKOUT_ORDER_STATUS,
  registerWebhookEvent,
  updateOrderStatusByIdentifiers,
} from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Stripe webhook secret is missing.");
  }
  return secret;
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
    }

    const body = await request.text();
    const webhookSecret = getWebhookSecret();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    const rawPayload = JSON.parse(body);
    const metadata = (rawPayload.data?.object?.metadata ?? {}) as { orderId?: string };
    const orderId = metadata.orderId || "";

    const isNewEvent = await registerWebhookEvent({
      stripeEventId: event.id,
      orderPublicId: orderId,
      eventType: event.type,
      payload: rawPayload,
    });

    if (!isNewEvent) {
      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      if (!paymentIntent?.id) {
        return NextResponse.json({ received: true });
      }

      const status =
        event.type === "payment_intent.succeeded"
          ? STRIPE_CHECKOUT_ORDER_STATUS.paid
          : STRIPE_CHECKOUT_ORDER_STATUS.failed;

      await updateOrderStatusByIdentifiers({
        orderPublicId: paymentIntent.metadata?.orderId ?? "",
        paymentIntentId: paymentIntent.id,
        status,
      });

      if (event.type === "payment_intent.succeeded") {
        const orderPublicId = paymentIntent.metadata?.orderId ?? "";

        if (orderPublicId) {
          try {
            await ensurePaidOrderEmails(orderPublicId);
          } catch (error) {
            console.error("[orders.email] Failed to send paid order email.", {
              orderPublicId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to process webhook." }, { status: 400 });
  }
}
