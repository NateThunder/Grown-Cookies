"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

type ShopNowLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  children: ReactNode;
};

const SHOP_SCROLL_RESET_KEY = "grown-cookies-reset-shop-scroll";

export default function ShopNowLink({ children, target, ...props }: ShopNowLinkProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/shop" || window.sessionStorage.getItem(SHOP_SCROLL_RESET_KEY) !== "true") {
      return;
    }

    window.sessionStorage.removeItem(SHOP_SCROLL_RESET_KEY);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) {
      return;
    }

    window.sessionStorage.setItem(SHOP_SCROLL_RESET_KEY, "true");

    if (pathname === "/shop") {
      event.preventDefault();
      window.history.pushState(null, "", "/shop");
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
  }

  return (
    <Link href="/shop" target={target} scroll onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
