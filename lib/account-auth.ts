import type { User } from "@supabase/supabase-js";
import { getSupabaseUserFromAccessToken } from "@/lib/supabase/admin-auth";

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

export async function getAuthenticatedSupabaseUser(request: Request): Promise<User | null> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return null;
  }

  return getSupabaseUserFromAccessToken(accessToken);
}
