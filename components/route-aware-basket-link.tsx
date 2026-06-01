"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import BasketLink from "@/components/basket-link";

type RouteAwareBasketLinkProps = ComponentProps<typeof BasketLink>;

function shouldSuppressBasket(pathname: string | null) {
  return pathname === "/launch" || pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
}

export default function RouteAwareBasketLink(props: RouteAwareBasketLinkProps) {
  const pathname = usePathname();

  if (shouldSuppressBasket(pathname)) {
    return null;
  }

  return <BasketLink {...props} />;
}
