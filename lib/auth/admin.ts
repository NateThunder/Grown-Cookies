import "server-only";

import { getAuthSession } from "./server";
import { isAdminAuthUser, type AppAuthUser } from "./types";

export async function getAdminUserFromHeaders(headers: Headers): Promise<AppAuthUser | null> {
  try {
    const session = await getAuthSession(headers);
    const user = (session?.user as AppAuthUser | undefined) ?? null;
    return isAdminAuthUser(user) ? user : null;
  } catch {
    return null;
  }
}

export function getAdminAccessDeniedMessage() {
  return "Access denied.";
}
