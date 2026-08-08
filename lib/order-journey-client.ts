"use client";

import { readStoredCookieConsent } from "@/lib/cookie-consent-client";
import {
  ORDER_JOURNEY_CONSENT,
  type OrderJourneyEvent,
  type OrderJourneyEventType,
  type OrderJourneySnapshot,
} from "@/lib/order-journey";

const ORDER_JOURNEY_STORAGE_KEY = "grown-cookies-order-journey";
const ORDER_JOURNEY_MAX_EVENTS = 20;

const KNOWN_SOURCES: Array<[RegExp, string]> = [
  [/instagram|l\.instagram\.com/i, "Instagram"],
  [/google/i, "Google"],
  [/facebook|fb\.com|fbclid/i, "Facebook"],
  [/tiktok/i, "TikTok"],
  [/youtube|youtu\.be/i, "YouTube"],
  [/pinterest/i, "Pinterest"],
  [/whatsapp/i, "WhatsApp"],
  [/twitter|t\.co|\bx\b/i, "X"],
  [/email|newsletter|mail/i, "Email"],
];

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readJourney(): OrderJourneySnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORDER_JOURNEY_STORAGE_KEY) ?? "null") as
      | OrderJourneySnapshot
      | null;
    return parsed?.dayKey === getLocalDayKey() ? parsed : null;
  } catch {
    return null;
  }
}

function writeJourney(journey: OrderJourneySnapshot) {
  try {
    window.localStorage.setItem(ORDER_JOURNEY_STORAGE_KEY, JSON.stringify(journey));
  } catch {
    // Tracking must never interrupt shopping or checkout.
  }
}

function labelSource(value: string) {
  const normalized = value.trim().slice(0, 100);
  const known = KNOWN_SOURCES.find(([pattern]) => pattern.test(normalized));
  if (known) {
    return known[1];
  }

  try {
    const hostname = new URL(normalized).hostname.replace(/^www\./i, "");
    return hostname.slice(0, 50) || "Other";
  } catch {
    const simpleLabel = normalized.replace(/[^a-z0-9 ._-]/gi, "").trim();
    return simpleLabel ? simpleLabel.charAt(0).toUpperCase() + simpleLabel.slice(1, 49) : "Other";
  }
}

export function getCurrentPlatformSource() {
  if (typeof window === "undefined") {
    return "Direct";
  }

  const params = new URLSearchParams(window.location.search);
  const campaignSource = params.get("utm_source") ?? "";
  if (campaignSource) {
    return labelSource(campaignSource);
  }

  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.hostname !== window.location.hostname) {
        return labelSource(referrer.href);
      }
    } catch {
      // Invalid referrers are ignored.
    }
  }

  return "Direct";
}

export function clearOrderJourney() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(ORDER_JOURNEY_STORAGE_KEY);
  } catch {
    // Tracking must never interrupt shopping or checkout.
  }
}

export function recordOrderJourneyEvent(
  type: OrderJourneyEventType,
  options: { label?: string; productSlug?: string } = {},
) {
  if (typeof window === "undefined" || readStoredCookieConsent() !== "accepted") {
    return;
  }

  const current = readJourney();
  const events = current?.events ?? [];
  const productSlug = options.productSlug?.trim().slice(0, 120);
  const label = options.label?.trim().slice(0, 50) ?? "";
  const dedupeKey = `${type}:${productSlug ?? label}`;
  const alreadyRecorded = events.some(
    (event) => `${event.type}:${event.productSlug ?? event.label}` === dedupeKey,
  );

  if (alreadyRecorded) {
    return;
  }

  const event: OrderJourneyEvent = {
    type,
    label,
    occurredAt: new Date().toISOString(),
    ...(productSlug ? { productSlug } : {}),
  };

  writeJourney({
    consent: ORDER_JOURNEY_CONSENT.accepted,
    dayKey: getLocalDayKey(),
    events: [...events, event].slice(0, ORDER_JOURNEY_MAX_EVENTS),
  });
}

export function readOrderJourneyForCheckout(): OrderJourneySnapshot {
  if (typeof window === "undefined" || readStoredCookieConsent() !== "accepted") {
    return { consent: ORDER_JOURNEY_CONSENT.denied };
  }

  return (
    readJourney() ?? {
      consent: ORDER_JOURNEY_CONSENT.accepted,
      dayKey: getLocalDayKey(),
      events: [],
    }
  );
}
