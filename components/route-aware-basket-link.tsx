"use client";

import { usePathname } from "next/navigation";
import BasketLink from "@/components/basket-link";

type BasketLinkPosition = "top" | "floating" | "both";

type RouteAwareBasketLinkProps = {
  position?: BasketLinkPosition;
  renderDrawer?: boolean;
  triggerGlobalDrawer?: boolean;
};

export default function RouteAwareBasketLink(props: RouteAwareBasketLinkProps) {
  const pathname = usePathname();
  const isHiddenRoute =
    pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/launch";

  if (isHiddenRoute) {
    return null;
  }

  return <BasketLink {...props} />;
}
