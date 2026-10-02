import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { compare as verifyBcryptPassword } from "bcryptjs";
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { lastLoginMethod } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { getRequiredD1Binding } from "@/lib/cloudflare-d1";
import { sendAccountPasswordResetEmail, sendAccountVerificationEmail } from "./emails";
import { authUserAdditionalFields } from "./schema";
import type { AppAuthUser } from "./types";

const SESSION_LENGTH_SECONDS = 60 * 60 * 24 * 7;
const SESSION_REFRESH_SECONDS = 60 * 60 * 24;
const EMAIL_VERIFICATION_SECONDS = 60 * 60 * 24;
const PASSWORD_RESET_SECONDS = 60 * 60;
const DEFAULT_AUTH_URL = "https://growncookies.co.uk";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBaseUrl() {
  return (
    normalizeText(process.env.BETTER_AUTH_URL) ||
    normalizeText(process.env.NEXT_PUBLIC_SITE_URL) ||
    DEFAULT_AUTH_URL
  ).replace(/\/+$/, "");
}

function getTrustedOrigins() {
  const configured = normalizeText(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return Array.from(
    new Set([
      getBaseUrl(),
      "https://growncookies.co.uk",
      "https://www.growncookies.co.uk",
      "http://localhost:3000",
      ...configured,
    ]),
  );
}

async function verifyCompatiblePassword({ hash, password }: { hash: string; password: string }) {
  if (/^\$2[aby]\$/.test(hash)) {
    return verifyBcryptPassword(password, hash);
  }

  return verifyPassword({ hash, password });
}

async function buildAuth() {
  const db = await getRequiredD1Binding();
  const { cf } = await getCloudflareContext({ async: true });

  return betterAuth({
    ...withCloudflare(
      {
        d1Native: db,
        autoDetectIpAddress: true,
        geolocationTracking: false,
        cf,
      },
      {
        appName: "Grown Cookies",
        baseURL: getBaseUrl(),
        secret: normalizeText(process.env.BETTER_AUTH_SECRET),
        trustedOrigins: getTrustedOrigins(),
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: true,
          minPasswordLength: 8,
          maxPasswordLength: 128,
          autoSignIn: false,
          resetPasswordTokenExpiresIn: PASSWORD_RESET_SECONDS,
          revokeSessionsOnPasswordReset: true,
          password: {
            hash: hashPassword,
            verify: verifyCompatiblePassword,
          },
          async sendResetPassword({ user, url }) {
            await sendAccountPasswordResetEmail({
              to: user.email,
              name: user.name,
              url,
            });
          },
        },
        emailVerification: {
          sendOnSignUp: true,
          sendOnSignIn: true,
          autoSignInAfterVerification: true,
          expiresIn: EMAIL_VERIFICATION_SECONDS,
          async sendVerificationEmail({ user, url }) {
            await sendAccountVerificationEmail({
              to: user.email,
              name: user.name,
              url,
            });
          },
        },
        user: {
          additionalFields: authUserAdditionalFields,
        },
        session: {
          expiresIn: SESSION_LENGTH_SECONDS,
          updateAge: SESSION_REFRESH_SECONDS,
          deferSessionRefresh: true,
        },
        verification: {
          storeIdentifier: "hashed",
        },
        rateLimit: {
          enabled: true,
          storage: "database",
          window: 60,
          max: 100,
          customRules: {
            "/sign-in/email": { window: 60, max: 5 },
            "/request-password-reset": { window: 60, max: 1 },
            "/send-verification-email": { window: 60, max: 1 },
          },
        },
        plugins: [
          lastLoginMethod({
            storeInDatabase: true,
            beforeStoreCookie: () => false,
          }),
        ],
      },
    ),
  });
}

let authInstance: Awaited<ReturnType<typeof buildAuth>> | null = null;
let authPromise: Promise<Awaited<ReturnType<typeof buildAuth>>> | null = null;

export async function getAuth() {
  if (authInstance) {
    return authInstance;
  }

  if (!authPromise) {
    authPromise = buildAuth().then((instance) => {
      authInstance = instance;
      return instance;
    });
  }

  return authPromise;
}

export async function getAuthSession(headers: Headers) {
  const auth = await getAuth();
  return auth.api.getSession({ headers });
}

export async function getAuthenticatedUser(request: Request): Promise<AppAuthUser | null> {
  try {
    const session = await getAuthSession(request.headers);
    return (session?.user as AppAuthUser | undefined) ?? null;
  } catch {
    return null;
  }
}

export function hasBetterAuthConfig() {
  return Boolean(normalizeText(process.env.BETTER_AUTH_SECRET));
}

export type GrownCookiesAuth = Awaited<ReturnType<typeof getAuth>>;
