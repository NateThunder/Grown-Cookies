import {
  clearAdminLoginFailures,
  getAdminLoginBlockedMessage,
  getAdminLoginThrottleState,
  getAdminLoginWarningMessage,
  recordAdminLoginFailure,
} from "@/lib/admin-login-throttle";
import {
  getAdminAccessDeniedMessage,
  getSupabaseUserFromAccessToken,
  isAdminUser,
  signInToSupabaseWithPassword,
} from "@/lib/supabase/admin-auth";

export type AdminSignInResult =
  | {
      ok: true;
      accessToken: string;
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

  const result = await signInToSupabaseWithPassword({
    email: normalizedEmail,
    password,
  });

  if ("errorMessage" in result) {
    const failedState = await recordAdminLoginFailure(normalizedEmail);

    return {
      ok: false,
      error: failedState.blocked ? getAdminLoginBlockedMessage(failedState) : result.errorMessage,
      warning: getAdminLoginWarningMessage(failedState) ?? undefined,
    };
  }

  const user = result.user ?? (await getSupabaseUserFromAccessToken(result.accessToken));

  if (!isAdminUser(user)) {
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
    accessToken: result.accessToken,
  };
}
