"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiUser } from "react-icons/fi";
import { authClient, useSession } from "@/lib/auth/client";
import { getAuthUserDisplayName, type AppAuthUser } from "@/lib/auth/types";
import styles from "./site-header.module.css";

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "AC";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function HeaderAccountLink() {
  const { data: session } = useSession();
  const user = (session?.user as AppAuthUser | undefined) ?? null;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      return;
    }

    setIsMenuOpen(false);
  }

  const displayName = getAuthUserDisplayName(user);
  const initials = getInitials(displayName);
  const isSignedIn = Boolean(user);

  if (!isSignedIn) {
    return (
      <div className={styles.accountSlot}>
        <Link href="/account" aria-label="Account" className={styles.accountLink}>
          <FiUser aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.accountSlot}>
      <div className={styles.accountMenu} ref={menuRef}>
        <button
          type="button"
          className={styles.accountMenuButton}
          aria-label={displayName ? `Account menu, ${displayName}` : "Account menu"}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={() => {
            setIsMenuOpen((open) => !open);
          }}
        >
          <span className={styles.accountBadge} aria-hidden="true">
            {initials}
          </span>
        </button>

        {isMenuOpen ? (
          <div className={styles.accountDropdown} role="menu" aria-label="Account menu">
            <p className={styles.accountDropdownLabel}>{displayName || "My account"}</p>
            <Link
              href="/account"
              className={styles.accountDropdownLink}
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
              }}
            >
              Account
            </Link>
            <button
              type="button"
              className={styles.accountDropdownAction}
              role="menuitem"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
