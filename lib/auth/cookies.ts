import "server-only";

import { cookies } from "next/headers";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";

export async function applyAuthResponseCookies(responseHeaders: Headers) {
  const rawSetCookie = responseHeaders.get("set-cookie");

  if (!rawSetCookie) {
    return;
  }

  const cookieStore = await cookies();
  const parsed = parseSetCookieHeader(rawSetCookie);

  parsed.forEach((attributes, name) => {
    if (name) {
      cookieStore.set(name, attributes.value, toCookieOptions(attributes));
    }
  });
}

export function getSessionTokenFromAuthHeaders(responseHeaders: Headers) {
  const rawSetCookie = responseHeaders.get("set-cookie");

  if (!rawSetCookie) {
    return "";
  }

  for (const [name, attributes] of parseSetCookieHeader(rawSetCookie)) {
    if (name.endsWith("session_token")) {
      return attributes.value.split(".")[0] ?? "";
    }
  }

  return "";
}
