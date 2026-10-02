import { headers } from "next/headers";
import type { AppAuthUser } from "@/lib/auth/types";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
import { getAdminUserFromHeaders } from "@/lib/auth/admin";
import { hasBetterAuthConfig } from "@/lib/auth/server";
import { getAdminFlashState, type AdminFlashState, type SearchParamValue } from "./admin-ui";

export type AdminPageContext = {
  params: Record<string, SearchParamValue>;
  flash: AdminFlashState;
  adminUser: AppAuthUser | null;
  authConfigured: boolean;
  d1Configured: boolean;
};

export async function getAdminPageContext(
  searchParams: Promise<Record<string, SearchParamValue>>,
): Promise<AdminPageContext> {
  const params = await searchParams;
  const flash = getAdminFlashState(params);

  const adminSessionUser = await getAdminUserFromHeaders(await headers());

  return {
    params,
    flash,
    adminUser: adminSessionUser,
    authConfigured: hasBetterAuthConfig(),
    d1Configured: hasCloudflareD1Config(),
  };
}
