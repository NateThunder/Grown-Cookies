import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import LaunchClient from "@/app/launch/launch-client";
import { getSiteLockAdminState } from "@/lib/site-lock";
import { getAdminPageContext } from "../admin-page-context";
import type { SearchParamValue } from "../admin-ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminLaunchPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

const ADMIN_LAUNCH_RETURN_PATH = "/admin/launch";

export default async function AdminLaunchPage({ searchParams }: AdminLaunchPageProps) {
  const context = await getAdminPageContext(searchParams);

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to launch the site"
        returnPath={ADMIN_LAUNCH_RETURN_PATH}
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  const siteLockSetting = context.d1Configured ? await getSiteLockAdminState() : null;

  return (
    <AdminShell
      eyebrow="Launch"
      title="Site launch"
      description="Use the launch control when the site is ready to go live."
      returnPath={ADMIN_LAUNCH_RETURN_PATH}
      flash={context.flash}
    >
      {siteLockSetting ? (
        <LaunchClient initialSiteLockEnabled={siteLockSetting.enabled} />
      ) : (
        <AdminD1RequiredState />
      )}
    </AdminShell>
  );
}
