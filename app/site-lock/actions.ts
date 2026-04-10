"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_AUTH_COOKIE,
  getAdminAccessDeniedMessage,
  getAdminAuthCookieOptions,
  getSupabaseUserFromAccessToken,
  isAdminUser,
  signInToSupabaseWithPassword,
} from "@/lib/supabase/admin-auth";

export type SiteLockActionState = {
  error?: string;
};

function getTextField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function getSiteLockReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/admin")) {
    return "/";
  }

  return value;
}

export async function siteLockLoginAction(
  _previousState: SiteLockActionState,
  formData: FormData,
): Promise<SiteLockActionState> {
  const email = getTextField(formData, "email").trim();
  const password = getTextField(formData, "password");
  const returnPath = getSiteLockReturnPath(getTextField(formData, "returnPath"));

  if (!email || !password) {
    return {
      error: "Enter both email and password.",
    };
  }

  const result = await signInToSupabaseWithPassword({
    email,
    password,
  });

  if ("errorMessage" in result) {
    return {
      error: result.errorMessage,
    };
  }

  const user = result.user ?? (await getSupabaseUserFromAccessToken(result.accessToken));

  if (!isAdminUser(user)) {
    return {
      error: getAdminAccessDeniedMessage(),
    };
  }

  const cookieStore = await cookies();
  const cookieConfig = getAdminAuthCookieOptions();

  cookieStore.set(ADMIN_AUTH_COOKIE, result.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookieConfig.maxAge,
  });

  redirect(returnPath);
}
