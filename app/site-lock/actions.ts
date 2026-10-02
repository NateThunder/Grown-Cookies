"use server";

import { redirect } from "next/navigation";
import { authenticateAdminCredentials } from "@/lib/admin-signin";
import { applyAuthResponseCookies } from "@/lib/auth/cookies";

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

  await applyAuthResponseCookies(result.responseHeaders);

  redirect(returnPath);
}
