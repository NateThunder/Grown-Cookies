import { getRequestIpAddress } from "@/lib/request-ip";

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export const CONTACT_TURNSTILE_VERIFICATION_MESSAGE =
  "Complete the verification check and try again.";

type ContactTurnstileErrorKind = "configuration" | "verification" | "unavailable";

type TurnstileSiteverifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export class ContactTurnstileError extends Error {
  constructor(
    readonly kind: ContactTurnstileErrorKind,
    message: string,
    readonly errorCodes: string[] = [],
  ) {
    super(message);
    this.name = "ContactTurnstileError";
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function getContactTurnstileSiteKey() {
  return (
    normalizeText(process.env.TURNSTILE_SITE_KEY) ||
    (isProductionEnvironment() ? "" : TURNSTILE_TEST_SITE_KEY)
  );
}

function getContactTurnstileSecretKey() {
  return (
    normalizeText(process.env.TURNSTILE_SECRET_KEY) ||
    (isProductionEnvironment() ? "" : TURNSTILE_TEST_SECRET_KEY)
  );
}

function isTurnstileConfigurationError(errorCodes: string[]) {
  return errorCodes.some(
    (errorCode) => errorCode === "missing-input-secret" || errorCode === "invalid-input-secret",
  );
}

function isTurnstileUnavailableError(errorCodes: string[]) {
  return errorCodes.some((errorCode) => errorCode === "internal-error");
}

function getTurnstileFailureKind(errorCodes: string[]): ContactTurnstileErrorKind {
  if (isTurnstileConfigurationError(errorCodes)) {
    return "configuration";
  }

  if (isTurnstileUnavailableError(errorCodes)) {
    return "unavailable";
  }

  return "verification";
}

async function readTurnstileResponse(response: Response): Promise<TurnstileSiteverifyResponse> {
  try {
    return (await response.json()) as TurnstileSiteverifyResponse;
  } catch {
    throw new ContactTurnstileError("unavailable", "Turnstile returned an invalid response.");
  }
}

export async function verifyContactTurnstileToken({
  request,
  token,
}: {
  request: Request;
  token: string;
}) {
  const secret = getContactTurnstileSecretKey();

  if (!secret) {
    throw new ContactTurnstileError("configuration", "Turnstile secret key is not configured.");
  }

  if (!token || token.length > 2048) {
    throw new ContactTurnstileError("verification", CONTACT_TURNSTILE_VERIFICATION_MESSAGE);
  }

  const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: getRequestIpAddress(request) ?? undefined,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ContactTurnstileError("unavailable", "Turnstile validation request failed.");
  }

  const result = await readTurnstileResponse(response);

  if (!result.success) {
    const errorCodes = result["error-codes"] ?? [];
    throw new ContactTurnstileError(
      getTurnstileFailureKind(errorCodes),
      CONTACT_TURNSTILE_VERIFICATION_MESSAGE,
      errorCodes,
    );
  }
}
