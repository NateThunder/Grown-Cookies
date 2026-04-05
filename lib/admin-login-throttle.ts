import { createHash } from "node:crypto";
import { headers } from "next/headers";
import {
  executeCloudflareD1,
  hasCloudflareD1Config,
  queryCloudflareD1,
} from "@/lib/cloudflare-d1";

const ATTEMPT_WINDOW_MINUTES = 15;
const COOLDOWN_MINUTES = 15;
const EMAIL_FAILURE_THRESHOLD = 3;
const IP_FAILURE_THRESHOLD = 6;
const RETENTION_HOURS = 48;

type ThrottleScope = "email" | "ip";

type IdentifierScope = {
  scope: ThrottleScope;
  identifierHash: string;
  threshold: number;
};

type ScopeEvaluation = {
  scope: ThrottleScope;
  threshold: number;
  failureCount: number;
  attemptsRemaining: number;
  blocked: boolean;
  retryAfterSeconds: number;
};

type FailureSummaryRow = {
  failure_count: number | string | null;
  last_attempted_at: string | null;
};

export type AdminLoginThrottleState = {
  blocked: boolean;
  retryAfterSeconds: number;
  attemptsRemaining: number;
  failureCount: number;
  limitedBy: ThrottleScope | null;
};

let schemaReadyPromise: Promise<void> | null = null;
const fallbackAttempts = new Map<string, number[]>();

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
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

async function getRequestIpAddress() {
  try {
    const headerStore = await headers();

    return (
      parseRequestIp(headerStore.get("cf-connecting-ip")) ??
      parseRequestIp(headerStore.get("x-nf-client-connection-ip")) ??
      parseForwardedForHeader(headerStore.get("x-forwarded-for") ?? "") ??
      parseRequestIp(headerStore.get("x-real-ip"))
    );
  } catch {
    return null;
  }
}

function hashIdentifier(scope: ThrottleScope, identifier: string) {
  const secret = normalizeText(process.env.ADMIN_LOGIN_THROTTLE_SECRET);

  return createHash("sha256")
    .update(`gc-admin-login-throttle:${scope}:${secret}:${identifier}`)
    .digest("hex");
}

async function getIdentifierScopes(email: string): Promise<IdentifierScope[]> {
  const identifiers: IdentifierScope[] = [];
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
    identifiers.push({
      scope: "email",
      identifierHash: hashIdentifier("email", normalizedEmail),
      threshold: EMAIL_FAILURE_THRESHOLD,
    });
  }

  const ipAddress = await getRequestIpAddress();

  if (ipAddress) {
    identifiers.push({
      scope: "ip",
      identifierHash: hashIdentifier("ip", ipAddress),
      threshold: IP_FAILURE_THRESHOLD,
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
  failureCount,
  lastAttemptedAt,
}: {
  scope: ThrottleScope;
  threshold: number;
  failureCount: number;
  lastAttemptedAt: Date | null;
}): ScopeEvaluation {
  const now = Date.now();
  const retryAfterSeconds = lastAttemptedAt
    ? Math.max(0, Math.ceil((lastAttemptedAt.getTime() + COOLDOWN_MINUTES * 60_000 - now) / 1000))
    : 0;
  const blocked = failureCount >= threshold && retryAfterSeconds > 0;

  return {
    scope,
    threshold,
    failureCount,
    attemptsRemaining: Math.max(0, threshold - failureCount),
    blocked,
    retryAfterSeconds: blocked ? retryAfterSeconds : 0,
  };
}

function summarizeScopeEvaluations(states: ScopeEvaluation[]): AdminLoginThrottleState {
  if (states.length === 0) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
      attemptsRemaining: EMAIL_FAILURE_THRESHOLD,
      failureCount: 0,
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
      failureCount: blockedState.failureCount,
      limitedBy: blockedState.scope,
    };
  }

  const primaryState = [...states].sort((left, right) => {
    const usageDelta =
      right.failureCount / right.threshold - left.failureCount / left.threshold;

    if (usageDelta !== 0) {
      return usageDelta;
    }

    return right.failureCount - left.failureCount;
  })[0];

  return {
    blocked: false,
    retryAfterSeconds: 0,
    attemptsRemaining: primaryState.attemptsRemaining,
    failureCount: primaryState.failureCount,
    limitedBy: primaryState.scope,
  };
}

async function ensureAdminLoginThrottleSchema() {
  if (!hasCloudflareD1Config()) {
    return;
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await executeCloudflareD1(
        `CREATE TABLE IF NOT EXISTS admin_login_attempts (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           scope TEXT NOT NULL,
           identifier_hash TEXT NOT NULL,
           attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );

      await executeCloudflareD1(
        `CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_scope_identifier_time
         ON admin_login_attempts(scope, identifier_hash, attempted_at)`,
      );

      await executeCloudflareD1(
        "CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_attempted_at ON admin_login_attempts(attempted_at)",
      );

      await executeCloudflareD1(
        "DELETE FROM admin_login_attempts WHERE datetime(attempted_at) < datetime('now', ?)",
        [`-${RETENTION_HOURS} hours`],
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function getD1ScopeEvaluation(identifier: IdentifierScope) {
  const rows = await queryCloudflareD1<FailureSummaryRow>(
    `SELECT
       COUNT(*) AS failure_count,
       MAX(attempted_at) AS last_attempted_at
     FROM admin_login_attempts
     WHERE scope = ?
       AND identifier_hash = ?
       AND datetime(attempted_at) >= datetime('now', ?)`,
    [identifier.scope, identifier.identifierHash, `-${ATTEMPT_WINDOW_MINUTES} minutes`],
    { cache: "no-store" },
  );

  const row = rows[0];
  const failureCount = Number.parseInt(String(row?.failure_count ?? "0"), 10);

  return evaluateScopeState({
    scope: identifier.scope,
    threshold: identifier.threshold,
    failureCount: Number.isFinite(failureCount) ? failureCount : 0,
    lastAttemptedAt: parseTimestamp(row?.last_attempted_at ?? null),
  });
}

function isMissingThrottleSchemaError(error: unknown) {
  return error instanceof Error && /no such table/i.test(error.message);
}

function getFallbackKey(identifier: IdentifierScope) {
  return `${identifier.scope}:${identifier.identifierHash}`;
}

function getFallbackScopeEvaluation(identifier: IdentifierScope) {
  const now = Date.now();
  const windowStart = now - ATTEMPT_WINDOW_MINUTES * 60_000;
  const retentionStart = now - RETENTION_HOURS * 60 * 60_000;
  const cacheKey = getFallbackKey(identifier);
  const timestamps = (fallbackAttempts.get(cacheKey) ?? []).filter((timestamp) => timestamp >= retentionStart);

  fallbackAttempts.set(cacheKey, timestamps);

  const recentAttempts = timestamps.filter((timestamp) => timestamp >= windowStart);
  const lastAttemptTimestamp = recentAttempts.at(-1) ?? null;

  return evaluateScopeState({
    scope: identifier.scope,
    threshold: identifier.threshold,
    failureCount: recentAttempts.length,
    lastAttemptedAt: lastAttemptTimestamp ? new Date(lastAttemptTimestamp) : null,
  });
}

export async function getAdminLoginThrottleState(email: string): Promise<AdminLoginThrottleState> {
  const identifiers = await getIdentifierScopes(email);

  if (identifiers.length === 0) {
    return summarizeScopeEvaluations([]);
  }

  if (hasCloudflareD1Config()) {
    try {
      const states = await Promise.all(identifiers.map((identifier) => getD1ScopeEvaluation(identifier)));
      return summarizeScopeEvaluations(states);
    } catch (error) {
      if (isMissingThrottleSchemaError(error)) {
        try {
          await ensureAdminLoginThrottleSchema();
          const states = await Promise.all(identifiers.map((identifier) => getD1ScopeEvaluation(identifier)));
          return summarizeScopeEvaluations(states);
        } catch {
          // Fall back to local process memory so admin access is not fully blocked by D1 availability.
        }
      }

      // Fall back to local process memory so admin access is not fully blocked by D1 availability.
    }
  }

  const states = identifiers.map((identifier) => getFallbackScopeEvaluation(identifier));
  return summarizeScopeEvaluations(states);
}

export async function recordAdminLoginFailure(email: string) {
  const identifiers = await getIdentifierScopes(email);

  if (identifiers.length === 0) {
    return summarizeScopeEvaluations([]);
  }

  if (hasCloudflareD1Config()) {
    try {
      await ensureAdminLoginThrottleSchema();

      for (const identifier of identifiers) {
        await executeCloudflareD1(
          "INSERT INTO admin_login_attempts (scope, identifier_hash) VALUES (?, ?)",
          [identifier.scope, identifier.identifierHash],
        );
      }

      await executeCloudflareD1(
        "DELETE FROM admin_login_attempts WHERE datetime(attempted_at) < datetime('now', ?)",
        [`-${RETENTION_HOURS} hours`],
      );

      const states = await Promise.all(identifiers.map((identifier) => getD1ScopeEvaluation(identifier)));
      return summarizeScopeEvaluations(states);
    } catch {
      // Fall back to local process memory so failed logins still accumulate when D1 is down.
    }
  }

  const now = Date.now();
  const retentionStart = now - RETENTION_HOURS * 60 * 60_000;

  for (const identifier of identifiers) {
    const cacheKey = getFallbackKey(identifier);
    const timestamps = (fallbackAttempts.get(cacheKey) ?? []).filter((timestamp) => timestamp >= retentionStart);
    timestamps.push(now);
    fallbackAttempts.set(cacheKey, timestamps);
  }

  const states = identifiers.map((identifier) => getFallbackScopeEvaluation(identifier));
  return summarizeScopeEvaluations(states);
}

export async function clearAdminLoginFailures(email: string) {
  const identifiers = await getIdentifierScopes(email);

  if (identifiers.length === 0) {
    return;
  }

  if (hasCloudflareD1Config()) {
    try {
      await ensureAdminLoginThrottleSchema();

      for (const identifier of identifiers) {
        await executeCloudflareD1(
          "DELETE FROM admin_login_attempts WHERE scope = ? AND identifier_hash = ?",
          [identifier.scope, identifier.identifierHash],
        );
      }

      return;
    } catch {
      // Fall back to local process memory so successful logins still reset the local limiter.
    }
  }

  for (const identifier of identifiers) {
    fallbackAttempts.delete(getFallbackKey(identifier));
  }
}

function formatDuration(value: number) {
  if (value <= 60) {
    return `${Math.max(1, value)} second${value === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(value / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function getAdminLoginBlockedMessage(state: AdminLoginThrottleState) {
  return `Too many sign-in attempts. Try again in ${formatDuration(state.retryAfterSeconds)}.`;
}

export function getAdminLoginWarningMessage(state: AdminLoginThrottleState) {
  if (state.blocked || state.failureCount === 0 || state.attemptsRemaining > 2) {
    return null;
  }

  return `${state.attemptsRemaining} ${
    state.attemptsRemaining === 1 ? "attempt" : "attempts"
  } remaining before a ${COOLDOWN_MINUTES}-minute cooldown.`;
}
