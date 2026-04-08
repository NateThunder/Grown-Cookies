import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
import {
  ADMIN_AUTH_COOKIE,
  getAdminUserFromAccessToken,
  hasSupabasePublicConfig,
} from "@/lib/supabase/admin-auth";
import { getAdminFlashState, type AdminFlashState, type SearchParamValue } from "./admin-ui";

export type AdminPageContext = {
  params: Record<string, SearchParamValue>;
  flash: AdminFlashState;
  adminUser: User | null;
  supabaseConfigured: boolean;
  d1Configured: boolean;
};

export async function getAdminPageContext(
  searchParams: Promise<Record<string, SearchParamValue>>,
): Promise<AdminPageContext> {
  const params = await searchParams;
  const flash = getAdminFlashState(params);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const adminSessionUser = await getAdminUserFromAccessToken(accessToken);

  return {
    params,
    flash,
    adminUser: adminSessionUser,
    supabaseConfigured: hasSupabasePublicConfig(),
    d1Configured: hasCloudflareD1Config(),
  };
}
