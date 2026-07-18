"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./site-header.module.css";

type HeaderNavItem = {
  href: string;
  label: string;
  isActive: boolean;
};

type HeaderDesktopNavProps = {
  items: HeaderNavItem[];
};

const NAV_UNDERLINE_ANIMATION_MS = 320;

export default function HeaderDesktopNav({ items }: HeaderDesktopNavProps) {
  const router = useRouter();
  const [animatingHref, setAnimatingHref] = useState<string | null>(null);
  const navigationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const handleNavClick = (item: HeaderNavItem, event: MouseEvent<HTMLAnchorElement>) => {
    if (
      item.isActive ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
    }

    setAnimatingHref(item.href);
    navigationTimeoutRef.current = window.setTimeout(() => {
      router.push(item.href);
    }, NAV_UNDERLINE_ANIMATION_MS);
  };

  return (
    <nav className={styles.leftNav} aria-label="Primary navigation">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.isActive ? "page" : undefined}
          onClick={(event) => handleNavClick(item, event)}
          className={[
            styles.navLink,
            item.isActive && !animatingHref ? styles.navLinkActive : "",
            animatingHref === item.href ? styles.navLinkAnimating : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
