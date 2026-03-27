"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiUser } from "react-icons/fi";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./site-header.module.css";

function getDisplayName(user: User | null) {
  if (!user) {
    return "";
  }

  return (
    user.user_metadata?.full_name ||
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email ||
    ""
  );
}

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
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error) {
        setUser(data.user ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsMenuOpen(false);
      setIsSigningOut(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsSigningOut(false);
      return;
    }

    setIsMenuOpen(false);
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const isSignedIn = Boolean(user);

  if (!isSignedIn) {
    return (
      <Link href="/account" aria-label="Account" className={styles.accountLink}>
        <FiUser aria-hidden="true" />
      </Link>
    );
  }

  return (
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
  );
}
