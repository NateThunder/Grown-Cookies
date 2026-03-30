import Stripe from "stripe";
import type { CustomerProfile } from "@/lib/customer-profiles";
import type { SavedPaymentMethod } from "@/lib/saved-payment-methods";
import { setStripeCustomerIdForProfile } from "@/lib/customer-profiles";

const verifiedStripeCustomerIds = new Set<string>();

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
}

function toSavedPaymentMethod(paymentMethod: Stripe.PaymentMethod): SavedPaymentMethod | null {
  if (paymentMethod.type !== "card" || !paymentMethod.card) {
    return null;
  }

  return {
    id: normalizeText(paymentMethod.id),
    brand: normalizeText(paymentMethod.card.brand),
    last4: normalizeText(paymentMethod.card.last4),
    expMonth: Number(paymentMethod.card.exp_month ?? 0),
    expYear: Number(paymentMethod.card.exp_year ?? 0),
  };
}

export async function ensureStripeCustomerForProfile(profile: CustomerProfile) {
  const stripe = getStripeClient();
  const existingCustomerId = normalizeText(profile.stripeCustomerId);

  if (existingCustomerId) {
    if (verifiedStripeCustomerIds.has(existingCustomerId)) {
      return existingCustomerId;
    }

    try {
      const existingCustomer = await stripe.customers.retrieve(existingCustomerId);
      if (!("deleted" in existingCustomer) || !existingCustomer.deleted) {
        verifiedStripeCustomerIds.add(existingCustomerId);
        return existingCustomerId;
      }
    } catch {
      // Recreate the Stripe customer when the stored ID no longer resolves.
      verifiedStripeCustomerIds.delete(existingCustomerId);
    }
  }

  const customer = await stripe.customers.create({
    email: profile.email || undefined,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || undefined,
    phone: profile.phone || undefined,
    metadata: {
      customerProfileId: String(profile.id),
      supabaseUserId: profile.supabaseUserId,
      source: "grown-cookies",
    },
  });

  await setStripeCustomerIdForProfile(profile.id, customer.id);
  verifiedStripeCustomerIds.add(customer.id);
  return customer.id;
}

export async function listSavedPaymentMethodsForCustomer(customerId: string) {
  const stripe = getStripeClient();
  const paymentMethods = await stripe.paymentMethods.list({
    customer: normalizeText(customerId),
    type: "card",
  });

  return paymentMethods.data
    .map(toSavedPaymentMethod)
    .filter((paymentMethod): paymentMethod is SavedPaymentMethod => Boolean(paymentMethod?.id));
}

export async function listSavedPaymentMethodsForProfile(profile: CustomerProfile) {
  const customerId = normalizeText(profile.stripeCustomerId);

  if (!customerId) {
    return [];
  }

  return listSavedPaymentMethodsForCustomer(customerId);
}

export async function verifyCustomerPaymentMethodOwnership(customerId: string, paymentMethodId: string) {
  const stripe = getStripeClient();
  const paymentMethod = await stripe.paymentMethods.retrieve(normalizeText(paymentMethodId));
  const owner =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : normalizeText(paymentMethod.customer?.id);

  if (!owner || owner !== normalizeText(customerId) || paymentMethod.type !== "card" || !paymentMethod.card) {
    throw new Error("Saved payment method not found.");
  }

  return paymentMethod;
}

export async function detachSavedPaymentMethod(customerId: string, paymentMethodId: string) {
  const stripe = getStripeClient();
  await verifyCustomerPaymentMethodOwnership(customerId, paymentMethodId);
  await stripe.paymentMethods.detach(normalizeText(paymentMethodId));
}

export async function createSetupIntentForCustomer(customerId: string) {
  const stripe = getStripeClient();
  const setupIntent = await stripe.setupIntents.create({
    customer: normalizeText(customerId),
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: {
      source: "grown-cookies-account",
    },
  });

  if (!setupIntent.client_secret) {
    throw new Error("Could not start payment method setup.");
  }

  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
  };
}
