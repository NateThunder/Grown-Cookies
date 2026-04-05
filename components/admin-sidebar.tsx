"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { ADMIN_NAV_ITEMS, getAdminActiveSection } from "@/app/admin/admin-ui";
import styles from "@/app/admin/page.module.css";

export default function AdminSidebar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const activeSection = getAdminActiveSection(pathname, searchParams);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname, searchParamsKey]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTopRow}>
        <Link href="/" className={styles.brand} aria-label="Grown Cookies home">
          <span className={styles.brandMain}>
            grown
            <br />
            cookies
          </span>
          <span className={styles.brandTag}>product studio</span>
        </Link>

        <button
          type="button"
          className={styles.mobileMenuButton}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          aria-label={isMenuOpen ? "Close admin navigation" : "Open admin navigation"}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      <nav
        id={menuId}
        className={`${styles.sidebarNav} ${isMenuOpen ? styles.sidebarNavOpen : ""}`.trim()}
        aria-label="Admin sections"
      >
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`${styles.navItem} ${activeSection === item.id ? styles.navItemActive : ""}`.trim()}
            onClick={() => setIsMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
