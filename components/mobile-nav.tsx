"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { FiMenu, FiX } from "react-icons/fi";
import styles from "./site-header.module.css";

type MobileNavItem = {
  href: string;
  label: string;
  isActive?: boolean;
};

type MobileNavProps = {
  items: MobileNavItem[];
};

export default function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const drawerUi = (
    <>
      <div
        className={`${styles.mobileMenuBackdrop} ${isOpen ? styles.mobileMenuBackdropOpen : ""}`.trim()}
        onClick={() => setIsOpen(false)}
      />

      <aside
        id={menuId}
        className={`${styles.mobileMenuDrawer} ${isOpen ? styles.mobileMenuDrawerOpen : ""}`.trim()}
        aria-hidden={!isOpen}
        aria-label="Primary navigation"
      >
        <div className={styles.mobileMenuHeader}>
          <span>Menu</span>
          <button
            type="button"
            className={styles.mobileMenuClose}
            aria-label="Close navigation menu"
            onClick={() => setIsOpen(false)}
          >
            <FiX />
          </button>
        </div>

        <nav className={styles.mobileMenuNav}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.mobileMenuLink} ${item.isActive ? styles.mobileMenuLinkActive : ""}`.trim()}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );

  return (
    <>
      <button
        type="button"
        className={styles.mobileMenuButton}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="Open navigation menu"
        onClick={() => setIsOpen(true)}
      >
        <FiMenu />
      </button>
      {hasMounted && isOpen ? createPortal(drawerUi, document.body) : null}
    </>
  );
}
