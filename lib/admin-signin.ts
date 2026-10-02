import {
  clearAdminLoginFailures,
  getAdminLoginBlockedMessage,
  getAdminLoginThrottleState,
  getAdminLoginWarningMessage,
  recordAdminLoginFailure,
} from "@/lib/admin-login-throttle";
import {
  getAdminAccessDeniedMessage,
} from "@/lib/auth/admin";
import { getSessionTokenFromAuthHeaders } from "@/lib/auth/cookies";
import { getAuth } from "@/lib/auth/server";
import { isAdminAuthUser } from "@/lib/auth/types";
import { executeCloudflareD1 } from "@/lib/cloudflare-d1";

export type AdminSignInResult =
  | {
      ok: true;
      responseHeaders: Headers;
    }
  | {
      ok: false;
      error: string;
      warning?: string;
    };

export async function authenticateAdminCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AdminSignInResult> {
  const normalizedEmail = email.trim();

  if (!normalizedEmail || !password) {
    return {
      ok: false,
      error: "Enter both email and password.",
    };
  }

  const throttleState = await getAdminLoginThrottleState(normalizedEmail);

  if (throttleState.blocked) {
    return {
      ok: false,
      error: getAdminLoginBlockedMessage(throttleState),
    };
  }

  let responseHeaders: Headers;
  let user: unknown;

  try {
    const auth = await getAuth();
    const result = await auth.api.signInEmail({
      body: {
        email: normalizedEmail,
        password,
      },
      returnHeaders: true,
    });
    responseHeaders = result.headers;
    user = result.response.user;
  } catch {
    const failedState = await recordAdminLoginFailure(normalizedEmail);

    return {
      ok: false,
      error: failedState.blocked
        ? getAdminLoginBlockedMessage(failedState)
        : "Sign in failed. Check your email and password.",
      warning: getAdminLoginWarningMessage(failedState) ?? undefined,
    };
  }

  if (!isAdminAuthUser(user as Parameters<typeof isAdminAuthUser>[0])) {
    const sessionToken = getSessionTokenFromAuthHeaders(responseHeaders);
    if (sessionToken) {
      await executeCloudflareD1("DELETE FROM session WHERE token = ?", [sessionToken]).catch(() => null);
    }
    const failedState = await recordAdminLoginFailure(normalizedEmail);

    return {
      ok: false,
      error: failedState.blocked
        ? getAdminLoginBlockedMessage(failedState)
        : getAdminAccessDeniedMessage(),
      warning: getAdminLoginWarningMessage(failedState) ?? undefined,
    };
  }

  if (throttleState.failureCount > 0) {
    try {
      await clearAdminLoginFailures(normalizedEmail);
    } catch {
      // Successful admin logins should not fail if throttle-state cleanup is unavailable.
    }
  }

  return {
    ok: true,
    responseHeaders,
  };
}
