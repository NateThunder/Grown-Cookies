"use client";

import { usePathname, useSearchParams } from "next/navigation";
import SiteLockScreen from "@/components/site-lock-screen";

type SiteLockGateProps = {
  children: React.ReactNode;
  enabled: boolean;
  isUnlockedForAdmin: boolean;
};

export default function SiteLockGate({
  children,
  enabled,
  isUnlockedForAdmin,
}: SiteLockGateProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const currentPath = searchParams?.size ? `${pathname}?${searchParams.toString()}` : pathname;
  const shouldGatePublicRoute = enabled && !pathname.startsWith("/admin");

  if (shouldGatePublicRoute && !isUnlockedForAdmin) {
    return <SiteLockScreen returnPath={currentPath} />;
  }

  return children;
}
