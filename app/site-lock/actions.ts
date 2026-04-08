"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateAdminCredentials } from "@/lib/admin-signin";
import { ADMIN_AUTH_COOKIE, getAdminAuthCookieOptions } from "@/lib/supabase/admin-auth";

export type SiteLockActionState = {
  error?: string;
  warning?: string;
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
  const result = await authenticateAdminCredentials({
    email,
    password,
  });

  if (!result.ok) {
    return {
      error: result.error,
      warning: result.warning,
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
