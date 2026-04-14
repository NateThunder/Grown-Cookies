"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [currentPath, setCurrentPath] = useState(pathname);
  const shouldGatePublicRoute = enabled && !pathname.startsWith("/admin");

  useEffect(() => {
    setCurrentPath(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  if (shouldGatePublicRoute && !isUnlockedForAdmin) {
    return <SiteLockScreen returnPath={currentPath} />;
  }

  return children;
}
