import { createClient, type User } from "@supabase/supabase-js";

export const ADMIN_AUTH_COOKIE = "gc_admin_access_token";
const ADMIN_AUTH_MAX_AGE_SECONDS = 60 * 60;

type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

type SupabasePasswordAuthSuccess = {
  accessToken: string;
};

type SupabasePasswordAuthError = {
  errorMessage: string;
};

let serverSupabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function getServerSupabaseClient() {
  if (serverSupabaseClient) {
    return serverSupabaseClient;
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  serverSupabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverSupabaseClient;
}

function getAuthErrorMessage(payload?: unknown) {
  if (payload && typeof payload === "object") {
    const errorDescription =
      "error_description" in payload ? payload.error_description : null;
    const errorMessage = "msg" in payload ? payload.msg : null;
    const message =
      typeof errorDescription === "string"
        ? errorDescription
        : typeof errorMessage === "string"
          ? errorMessage
          : "";

    if (message.trim()) {
      return message.trim();
    }
  }

  return "Sign in failed. Check your email and password.";
}

export function hasSupabasePublicConfig() {
  return Boolean(getSupabasePublicConfig());
}

export function isAdminUser(user: Pick<User, "email"> | null | undefined) {
  const appMetadata =
    user && "app_metadata" in user && user.app_metadata && typeof user.app_metadata === "object"
      ? user.app_metadata
      : null;

  if (!appMetadata) {
    return false;
  }

  const role = String(
    ("user_role" in appMetadata ? appMetadata.user_role : null) ??
      ("role" in appMetadata ? appMetadata.role : null) ??
      "",
  )
    .trim()
    .toLowerCase();
  const isAdminFlag = "is_admin" in appMetadata ? appMetadata.is_admin === true : false;

  return role === "admin" || isAdminFlag;
}

export async function signInToSupabaseWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<SupabasePasswordAuthSuccess | SupabasePasswordAuthError> {
  const config = getSupabasePublicConfig();

  if (!config) {
    return {
      errorMessage:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  let response: Response;

  try {
    response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify({
        email,
        password,
      }),
      cache: "no-store",
    });
  } catch {
    return {
      errorMessage: "Could not reach Supabase. Check your network and Supabase URL.",
    };
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      errorMessage: getAuthErrorMessage(payload),
    };
  }

  if (!payload || typeof payload.access_token !== "string" || !payload.access_token) {
    return {
      errorMessage: "Supabase did not return an access token.",
    };
  }

  return {
    accessToken: payload.access_token,
  };
}

export async function getSupabaseUserFromAccessToken(accessToken: string): Promise<User | null> {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) {
      return null;
    }

    return data.user ?? null;
  } catch {
    return null;
  }
}

export function getAdminAccessDeniedMessage() {
  return "Access denied.";
}

export function getAdminAuthCookieOptions() {
  return {
    name: ADMIN_AUTH_COOKIE,
    maxAge: ADMIN_AUTH_MAX_AGE_SECONDS,
  };
}
