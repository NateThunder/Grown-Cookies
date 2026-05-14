import { createHash } from "node:crypto";
import { executeCloudflareD1, hasCloudflareD1Config, queryCloudflareD1 } from "@/lib/cloudflare-d1";
import { getRequestIpAddress } from "@/lib/request-ip";

const RETENTION_HOURS = 48;
const CLEANUP_INTERVAL_MS = 15 * 60_000;

const THROTTLE_CONFIG = {
  ip: {
    threshold: 5,
    windowMinutes: 10,
  },
  email: {
    threshold: 3,
    windowMinutes: 60,
  },
} as const;

type ContactThrottleScope = keyof typeof THROTTLE_CONFIG;

type IdentifierScope = {
  scope: ContactThrottleScope;
  identifierHash: string;
  threshold: number;
  windowMinutes: number;
};

type ScopeEvaluation = {
  scope: ContactThrottleScope;
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

type ContactAttemptThrottleInput = {
  request: Request;
  email: string;
};

let schemaReadyPromise: Promise<void> | null = null;
const fallbackAttempts = new Map<string, number[]>();
let lastCleanupCompletedAt = 0;

export type ContactAttemptThrottleState = {
  blocked: boolean;
  retryAfterSeconds: number;
  attemptsRemaining: number;
  attemptCount: number;
  limitedBy: ContactThrottleScope | null;
};

export class ContactAttemptThrottleError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "ContactAttemptThrottleError";
  }
}

class ContactAttemptThrottleStorageError extends Error {
  constructor() {
    super("Contact form throttle storage is unavailable.");
    this.name = "ContactAttemptThrottleStorageError";
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

function shouldUseFallbackThrottle() {
  return process.env.NODE_ENV !== "production";
}

function getThrottleSecret() {
  return (
    normalizeText(process.env.CONTACT_THROTTLE_SECRET) ||
    normalizeText(process.env.CHECKOUT_THROTTLE_SECRET) ||
    normalizeText(process.env.ADMIN_LOGIN_THROTTLE_SECRET) ||
    "grown-cookies-contact-throttle"
  );
}

function hashIdentifier(scope: ContactThrottleScope, identifier: string) {
  return createHash("sha256")
    .update(`gc-contact-attempts:${scope}:${getThrottleSecret()}:${identifier}`)
    .digest("hex");
}

function getIdentifierScopes(input: ContactAttemptThrottleInput): IdentifierScope[] {
  const identifiers: IdentifierScope[] = [];
  const ipAddress = getRequestIpAddress(input.request);
  const normalizedEmail = normalizeEmail(input.email);

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
  scope: ContactThrottleScope;
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

function summarizeScopeEvaluations(states: ScopeEvaluation[]): ContactAttemptThrottleState {
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

async function ensureContactAttemptThrottleSchema() {
  if (!hasCloudflareD1Config()) {
    if (shouldUseFallbackThrottle()) {
      return;
    }

    throw new ContactAttemptThrottleStorageError();
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS contact_form_attempts (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           scope TEXT NOT NULL,
           identifier_hash TEXT NOT NULL,
           attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );

      await executeCloudflareD1(
        `CREATE INDEX IF NOT EXISTS idx_contact_form_attempts_scope_identifier_time
         ON contact_form_attempts(scope, identifier_hash, attempted_at)`,
      );

      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_contact_form_attempts_attempted_at ON contact_form_attempts(attempted_at)",
      );

      await executeCloudflareD1(
        "DELETE FROM contact_form_attempts WHERE datetime(attempted_at) < datetime('now', ?)",
        [`-${RETENTION_HOURS} hours`],
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function cleanupExpiredContactAttempts(now = Date.now()) {
  if (now - lastCleanupCompletedAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  await executeCloudflareD1(
    "DELETE FROM contact_form_attempts WHERE datetime(attempted_at) < datetime('now', ?)",
    [`-${RETENTION_HOURS} hours`],
  );
  lastCleanupCompletedAt = now;
}

async function getD1ScopeEvaluation(identifier: IdentifierScope) {
  const rows = await queryCloudflareD1<AttemptSummaryRow>(
    `SELECT
       COUNT(*) AS attempt_count,
       MAX(attempted_at) AS last_attempted_at
     FROM contact_form_attempts
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

async function getContactAttemptThrottleState(
  input: ContactAttemptThrottleInput,
): Promise<ContactAttemptThrottleState> {
  const identifiers = getIdentifierScopes(input);

  if (identifiers.length === 0) {
    return summarizeScopeEvaluations([]);
  }

  if (hasCloudflareD1Config()) {
    try {
      await ensureContactAttemptThrottleSchema();
      const states = await Promise.all(identifiers.map((identifier) => getD1ScopeEvaluation(identifier)));
      return summarizeScopeEvaluations(states);
    } catch (error) {
      if (!shouldUseFallbackThrottle()) {
        throw error;
      }
    }
  } else if (!shouldUseFallbackThrottle()) {
    throw new ContactAttemptThrottleStorageError();
  }

  const states = identifiers.map((identifier) => getFallbackScopeEvaluation(identifier));
  return summarizeScopeEvaluations(states);
}

async function recordContactAttempt(input: ContactAttemptThrottleInput) {
  const identifiers = getIdentifierScopes(input);

  if (identifiers.length === 0) {
    return;
  }

  if (hasCloudflareD1Config()) {
    try {
      await ensureContactAttemptThrottleSchema();
      await executeCloudflareD1(
        `INSERT INTO contact_form_attempts (scope, identifier_hash)
         VALUES ${identifiers.map(() => "(?, ?)").join(", ")}`,
        identifiers.flatMap((identifier) => [identifier.scope, identifier.identifierHash]),
      );
      await cleanupExpiredContactAttempts();

      return;
    } catch (error) {
      if (!shouldUseFallbackThrottle()) {
        throw error;
      }
    }
  } else if (!shouldUseFallbackThrottle()) {
    throw new ContactAttemptThrottleStorageError();
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

export function getContactAttemptBlockedMessage(state: ContactAttemptThrottleState) {
  return `Too many enquiries. Try again in ${formatDuration(state.retryAfterSeconds)}.`;
}

export async function consumeContactAttempt(input: ContactAttemptThrottleInput) {
  const state = await getContactAttemptThrottleState(input);

  if (state.blocked) {
    throw new ContactAttemptThrottleError(
      getContactAttemptBlockedMessage(state),
      state.retryAfterSeconds,
    );
  }

  await recordContactAttempt(input);
}
