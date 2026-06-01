import { createHash } from "node:crypto";
import type { BasketStoredItem } from "@/lib/basket";
import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import type { StripeCheckoutDeliveryInput } from "@/lib/stripe-checkout";

const RETENTION_HOURS = 48;
const CLEANUP_INTERVAL_MS = 15 * 60_000;

const THROTTLE_CONFIG = {
  ip: {
    threshold: 8,
    windowMinutes: 10,
  },
  email: {
    threshold: 6,
    windowMinutes: 30,
  },
  delivery: {
    threshold: 6,
    windowMinutes: 30,
  },
  basket: {
    threshold: 10,
    windowMinutes: 15,
  },
} as const;

type CheckoutThrottleScope = keyof typeof THROTTLE_CONFIG;

type IdentifierScope = {
  scope: CheckoutThrottleScope;
  identifierHash: string;
  threshold: number;
  windowMinutes: number;
};

type ScopeEvaluation = {
  scope: CheckoutThrottleScope;
  threshold: number;
  attemptCount: number;
  attemptsRemaining: number;
  blocked: boolean;
  retryAfterSeconds: number;
};

type AttemptSummaryRow = {
  attempt_count: number | string | null;
  last_attempted_at: string | null;
};

export type CheckoutAttemptThrottleState = {
  blocked: boolean;
  retryAfterSeconds: number;
  attemptsRemaining: number;
  attemptCount: number;
  limitedBy: CheckoutThrottleScope | null;
};

type CheckoutAttemptThrottleInput = {
  request: Request;
  email: string;
  delivery: StripeCheckoutDeliveryInput;
  items: BasketStoredItem[];
};

let schemaReadyPromise: Promise<void> | null = null;
const fallbackAttempts = new Map<string, number[]>();
let lastCleanupCompletedAt = 0;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

function normalizePostcode(value: string) {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

function parseForwardedForHeader(value: string) {
  return value
    .split(",")
    .map((part) => normalizeText(part))
    .find(Boolean);
}

function parseRequestIp(value: string | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function getRequestIpAddress(request: Request) {
  return (
    parseRequestIp(request.headers.get("cf-connecting-ip")) ??
    parseRequestIp(request.headers.get("x-nf-client-connection-ip")) ??
    parseForwardedForHeader(request.headers.get("x-forwarded-for") ?? "") ??
    parseRequestIp(request.headers.get("x-real-ip"))
  );
}

function getThrottleSecret() {
  return (
    normalizeText(process.env.CHECKOUT_THROTTLE_SECRET) ||
    normalizeText(process.env.ADMIN_LOGIN_THROTTLE_SECRET) ||
    "grown-cookies-checkout-throttle"
  );
}

function hashIdentifier(scope: CheckoutThrottleScope, identifier: string) {
  return createHash("sha256")
    .update(`gc-checkout-attempts:${scope}:${getThrottleSecret()}:${identifier}`)
    .digest("hex");
}

function getBasketFingerprint(items: BasketStoredItem[]) {
  return items
    .map((item) => ({
      slug: normalizeText(item.slug),
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      giftCardAmountCents: Number.isFinite(item.giftCardAmountCents)
        ? item.giftCardAmountCents
        : 0,
      giftingCardId: normalizeText(item.gifting?.cardId),
      giftingMessage: normalizeText(item.gifting?.message),
    }))
    .filter((item) => item.slug && item.quantity > 0)
    .sort(
      (left, right) =>
        left.slug.localeCompare(right.slug) ||
        (left.giftCardAmountCents ?? 0) - (right.giftCardAmountCents ?? 0) ||
        left.giftingCardId.localeCompare(right.giftingCardId) ||
        left.giftingMessage.localeCompare(right.giftingMessage) ||
        left.quantity - right.quantity,
    )
    .map((item) => {
      const giftCardAmountCents = item.giftCardAmountCents ?? 0;

      return giftCardAmountCents > 0
        ? `${item.slug}:${giftCardAmountCents}:1`
        : `${item.slug}:${item.quantity}:${item.giftingCardId}:${item.giftingMessage}`;
    })
    .join("|");
}

function getDeliveryFingerprint(delivery: StripeCheckoutDeliveryInput) {
  return [
    normalizeText(delivery.country).toLowerCase(),
    normalizePostcode(delivery.postcode),
    normalizeText(delivery.city).toLowerCase(),
    normalizeText(delivery.address).toLowerCase(),
    normalizeText(delivery.flatNumber).toLowerCase(),
  ]
    .filter(Boolean)
    .join("|");
}

function getIdentifierScopes(input: CheckoutAttemptThrottleInput): IdentifierScope[] {
  const identifiers: IdentifierScope[] = [];
  const ipAddress = getRequestIpAddress(input.request);
  const normalizedEmail = normalizeEmail(input.email);
  const deliveryFingerprint = getDeliveryFingerprint(input.delivery);
  const basketFingerprint = getBasketFingerprint(input.items);

  if (ipAddress) {
    identifiers.push({
      scope: "ip",
      identifierHash: hashIdentifier("ip", ipAddress),
      threshold: THROTTLE_CONFIG.ip.threshold,
      windowMinutes: THROTTLE_CONFIG.ip.windowMinutes,
    });
  }

  if (normalizedEmail) {
    identifiers.push({
      scope: "email",
      identifierHash: hashIdentifier("email", normalizedEmail),
      threshold: THROTTLE_CONFIG.email.threshold,
      windowMinutes: THROTTLE_CONFIG.email.windowMinutes,
    });
  }

  if (deliveryFingerprint) {
    identifiers.push({
      scope: "delivery",
      identifierHash: hashIdentifier("delivery", deliveryFingerprint),
      threshold: THROTTLE_CONFIG.delivery.threshold,
      windowMinutes: THROTTLE_CONFIG.delivery.windowMinutes,
    });
  }

  if (basketFingerprint) {
    identifiers.push({
      scope: "basket",
      identifierHash: hashIdentifier("basket", basketFingerprint),
      threshold: THROTTLE_CONFIG.basket.threshold,
      windowMinutes: THROTTLE_CONFIG.basket.windowMinutes,
    });
  }

  return identifiers;
}

function parseTimestamp(value: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const isoCandidate = normalized.includes("T")
    ? normalized
    : normalized.replace(" ", "T");
  const withTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(isoCandidate)
    ? isoCandidate
    : `${isoCandidate}Z`;
  const parsed = new Date(withTimezone);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function evaluateScopeState({
  scope,
  threshold,
  windowMinutes,
  attemptCount,
  lastAttemptedAt,
}: {
  scope: CheckoutThrottleScope;
  threshold: number;
  windowMinutes: number;
  attemptCount: number;
  lastAttemptedAt: Date | null;
}): ScopeEvaluation {
  const now = Date.now();
  const retryAfterSeconds = lastAttemptedAt
    ? Math.max(0, Math.ceil((lastAttemptedAt.getTime() + windowMinutes * 60_000 - now) / 1000))
    : 0;
  const blocked = attemptCount >= threshold && retryAfterSeconds > 0;

  return {
    scope,
    threshold,
    attemptCount,
    attemptsRemaining: Math.max(0, threshold - attemptCount),
    blocked,
    retryAfterSeconds: blocked ? retryAfterSeconds : 0,
  };
}

function summarizeScopeEvaluations(states: ScopeEvaluation[]): CheckoutAttemptThrottleState {
  if (states.length === 0) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
      attemptsRemaining: THROTTLE_CONFIG.email.threshold,
      attemptCount: 0,
      limitedBy: null,
    };
  }

  const blockedState = states.reduce<ScopeEvaluation | null>((current, state) => {
    if (!state.blocked) {
      return current;
    }

    if (!current || state.retryAfterSeconds > current.retryAfterSeconds) {
      return state;
    }

    return current;
  }, null);

  if (blockedState) {
    return {
      blocked: true,
      retryAfterSeconds: blockedState.retryAfterSeconds,
      attemptsRemaining: 0,
      attemptCount: blockedState.attemptCount,
      limitedBy: blockedState.scope,
    };
  }

  const primaryState = [...states].sort((left, right) => {
    const usageDelta = right.attemptCount / right.threshold - left.attemptCount / left.threshold;

    if (usageDelta !== 0) {
      return usageDelta;
    }

    return right.attemptCount - left.attemptCount;
  })[0];

  return {
    blocked: false,
    retryAfterSeconds: 0,
    attemptsRemaining: primaryState.attemptsRemaining,
    attemptCount: primaryState.attemptCount,
    limitedBy: primaryState.scope,
  };
}

async function ensureCheckoutAttemptThrottleSchema() {
  if (!hasCloudflareD1Config()) {
    return;
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS checkout_payment_attempts (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           scope TEXT NOT NULL,
           identifier_hash TEXT NOT NULL,
           attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );

      await executeCloudflareD1(
        `CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_scope_identifier_time
         ON checkout_payment_attempts(scope, identifier_hash, attempted_at)`,
      );

      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_attempted_at ON checkout_payment_attempts(attempted_at)",
      );

      await executeCloudflareD1(
        "DELETE FROM checkout_payment_attempts WHERE datetime(attempted_at) < datetime('now', ?)",
        [`-${RETENTION_HOURS} hours`],
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function cleanupExpiredCheckoutAttempts(now = Date.now()) {
  if (now - lastCleanupCompletedAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  await executeCloudflareD1(
    "DELETE FROM checkout_payment_attempts WHERE datetime(attempted_at) < datetime('now', ?)",
    [`-${RETENTION_HOURS} hours`],
  );
  lastCleanupCompletedAt = now;
}

async function getD1ScopeEvaluation(identifier: IdentifierScope) {
  const rows = await queryCloudflareD1<AttemptSummaryRow>(
    `SELECT
       COUNT(*) AS attempt_count,
       MAX(attempted_at) AS last_attempted_at
     FROM checkout_payment_attempts
     WHERE scope = ?
       AND identifier_hash = ?
       AND datetime(attempted_at) >= datetime('now', ?)`,
    [identifier.scope, identifier.identifierHash, `-${identifier.windowMinutes} minutes`],
    { cache: "no-store" },
  );

  const row = rows[0];
  const attemptCount = Number.parseInt(String(row?.attempt_count ?? "0"), 10);

  return evaluateScopeState({
    scope: identifier.scope,
    threshold: identifier.threshold,
    windowMinutes: identifier.windowMinutes,
    attemptCount: Number.isFinite(attemptCount) ? attemptCount : 0,
    lastAttemptedAt: parseTimestamp(row?.last_attempted_at ?? null),
  });
}

function getFallbackKey(identifier: IdentifierScope) {
  return `${identifier.scope}:${identifier.identifierHash}`;
}

function getFallbackScopeEvaluation(identifier: IdentifierScope) {
  const now = Date.now();
  const windowStart = now - identifier.windowMinutes * 60_000;
  const retentionStart = now - RETENTION_HOURS * 60 * 60_000;
  const cacheKey = getFallbackKey(identifier);
  const timestamps = (fallbackAttempts.get(cacheKey) ?? []).filter(
    (timestamp) => timestamp >= retentionStart,
  );

  fallbackAttempts.set(cacheKey, timestamps);

  const recentAttempts = timestamps.filter((timestamp) => timestamp >= windowStart);
  const lastAttemptTimestamp = recentAttempts.at(-1) ?? null;

  return evaluateScopeState({
    scope: identifier.scope,
    threshold: identifier.threshold,
    windowMinutes: identifier.windowMinutes,
    attemptCount: recentAttempts.length,
    lastAttemptedAt: lastAttemptTimestamp ? new Date(lastAttemptTimestamp) : null,
  });
}

export async function getCheckoutAttemptThrottleState(
  input: CheckoutAttemptThrottleInput,
): Promise<CheckoutAttemptThrottleState> {
  const identifiers = getIdentifierScopes(input);

  if (identifiers.length === 0) {
    return summarizeScopeEvaluations([]);
  }

  if (hasCloudflareD1Config()) {
    try {
      await ensureCheckoutAttemptThrottleSchema();
      const states = await Promise.all(identifiers.map((identifier) => getD1ScopeEvaluation(identifier)));
      return summarizeScopeEvaluations(states);
    } catch {
      // Fall back to local process memory so development checkout still works when D1 is unavailable.
    }
  }

  const states = identifiers.map((identifier) => getFallbackScopeEvaluation(identifier));
  return summarizeScopeEvaluations(states);
}

async function recordCheckoutAttempt(input: CheckoutAttemptThrottleInput) {
  const identifiers = getIdentifierScopes(input);

  if (identifiers.length === 0) {
    return;
  }

  if (hasCloudflareD1Config()) {
    try {
      await ensureCheckoutAttemptThrottleSchema();
      await executeCloudflareD1(
        `INSERT INTO checkout_payment_attempts (scope, identifier_hash)
         VALUES ${identifiers.map(() => "(?, ?)").join(", ")}`,
        identifiers.flatMap((identifier) => [identifier.scope, identifier.identifierHash]),
      );
      await cleanupExpiredCheckoutAttempts();

      return;
    } catch {
      // Fall back to local process memory so attempts still accumulate when D1 writes fail.
    }
  }

  const now = Date.now();
  const retentionStart = now - RETENTION_HOURS * 60 * 60_000;

  for (const identifier of identifiers) {
    const cacheKey = getFallbackKey(identifier);
    const timestamps = (fallbackAttempts.get(cacheKey) ?? []).filter(
      (timestamp) => timestamp >= retentionStart,
    );
    timestamps.push(now);
    fallbackAttempts.set(cacheKey, timestamps);
  }
}

function formatDuration(value: number) {
  if (value <= 60) {
    return `${Math.max(1, value)} second${value === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(value / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function getCheckoutAttemptBlockedMessage(state: CheckoutAttemptThrottleState) {
  return `Too many checkout attempts. Try again in ${formatDuration(state.retryAfterSeconds)}.`;
}

export async function consumeCheckoutAttempt(input: CheckoutAttemptThrottleInput) {
  const state = await getCheckoutAttemptThrottleState(input);

  if (state.blocked) {
    throw new Error(getCheckoutAttemptBlockedMessage(state));
  }

  await recordCheckoutAttempt(input);
}
