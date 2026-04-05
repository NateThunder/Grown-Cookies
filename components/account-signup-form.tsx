"use client";

import { FormEvent, useEffect, useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./account-signup-form.module.css";
import type { Session, User } from "@supabase/supabase-js";

type AuthMode = "signup" | "signin";

type Status =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const initialStatus: Status = {
  type: "idle",
  message: "",
};

const DEFAULT_SITE_URL = "https://growncookies.co.uk";

function getCanonicalAccountRedirectUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (configuredSiteUrl && /^https?:\/\//i.test(configuredSiteUrl)) {
    return `${configuredSiteUrl}/account`;
  }

  return `${DEFAULT_SITE_URL}/account`;
}

export default function AccountSignupForm() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setStatus({
          type: "error",
          message: error.message,
        });
        return;
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsSubmitting(false);
      setIsGoogleSubmitting(false);
      setIsSigningOut(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const displayName =
    user?.user_metadata?.full_name ||
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") ||
    user?.email ||
    "Customer";

  async function handleSignOut() {
    setStatus(initialStatus);

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setStatus({
        type: "error",
        message:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.",
      });
      return;
    }

    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    setIsSigningOut(false);

    if (error) {
      setStatus({
        type: "error",
        message: error.message,
      });
      return;
    }

    setStatus({
      type: "success",
      message: "You have been signed out.",
    });
  }

  async function handleGoogleSignup() {
    setStatus(initialStatus);

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setStatus({
        type: "error",
        message:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.",
      });
      return;
    }

    setIsGoogleSubmitting(true);

    const redirectTo = getCanonicalAccountRedirectUrl();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    setIsGoogleSubmitting(false);

    if (error) {
      setStatus({
        type: "error",
        message: error.message,
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(initialStatus);

    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password || (mode === "signup" && (!firstName || !lastName))) {
      setStatus({
        type: "error",
        message:
          mode === "signup"
            ? "Complete all fields before creating an account."
            : "Enter your email and password to sign in.",
      });
      return;
    }

    if (password.length < 8) {
      setStatus({
        type: "error",
        message: "Use a password with at least 8 characters.",
      });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setStatus({
        type: "error",
        message:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.",
      });
      return;
    }

    setIsSubmitting(true);

    let error: string | null = null;

    if (mode === "signup") {
      const emailRedirectTo = getCanonicalAccountRedirectUrl();

      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
          },
          emailRedirectTo,
        },
      });

      if (response.error) {
        error = response.error.message;
      } else if (response.data.session) {
        setStatus({
          type: "success",
          message: "Account created and signed in.",
        });
      } else {
        setStatus({
          type: "success",
          message:
            "Account created. Check your inbox to confirm your email before signing in.",
        });
      }
    } else {
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (response.error) {
        error = response.error.message;
      } else {
        setStatus({
          type: "success",
          message: "Signed in successfully.",
        });
      }
    }

    setIsSubmitting(false);

    if (error) {
      setStatus({
        type: "error",
        message: error,
      });
      return;
    }

    event.currentTarget.reset();
  }

  if (session && user) {
    return (
      <div className={styles.accountState}>
        <div className={styles.accountSummary}>
          <p className={styles.accountEyebrow}>Signed in</p>
          <h3>Welcome back, {displayName}</h3>
          <p>{user.email}</p>
        </div>

        <button
          className={styles.submit}
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>

        <p
          className={`${styles.status} ${
            status.type === "error" ? styles.error : ""
          } ${status.type === "success" ? styles.success : ""}`.trim()}
          aria-live="polite"
        >
          {status.message}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.authCard}>
      <div className={styles.modeSwitch} role="tablist" aria-label="Account access">
        <button
          type="button"
          className={`${styles.modeButton} ${mode === "signup" ? styles.modeButtonActive : ""}`.trim()}
          onClick={() => {
            setMode("signup");
            setStatus(initialStatus);
          }}
          aria-pressed={mode === "signup"}
        >
          Create account
        </button>
        <button
          type="button"
          className={`${styles.modeButton} ${mode === "signin" ? styles.modeButtonActive : ""}`.trim()}
          onClick={() => {
            setMode("signin");
            setStatus(initialStatus);
          }}
          aria-pressed={mode === "signin"}
        >
          Sign in
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <div className={styles.identityGrid}>
            <label className={styles.field}>
              <span>First name</span>
              <input name="firstName" type="text" autoComplete="given-name" />
            </label>

            <label className={styles.field}>
              <span>Last name</span>
              <input name="lastName" type="text" autoComplete="family-name" />
            </label>
          </div>
        ) : null}

        <label className={styles.field}>
          <span>Email address</span>
          <input name="email" type="email" autoComplete="email" />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>

        <button className={styles.submit} type="submit" disabled={isSubmitting || isGoogleSubmitting}>
          {isSubmitting
            ? mode === "signup"
              ? "Creating account..."
              : "Signing in..."
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>

        <button
          className={styles.googleButton}
          type="button"
          onClick={handleGoogleSignup}
          disabled={isGoogleSubmitting || isSubmitting}
        >
          <span className={styles.googleIconBadge} aria-hidden="true">
            <FaGoogle />
          </span>
          <span>{isGoogleSubmitting ? "Opening Google..." : "Continue with Google"}</span>
        </button>

        <p
          className={`${styles.status} ${
            status.type === "error" ? styles.error : ""
          } ${status.type === "success" ? styles.success : ""}`.trim()}
          aria-live="polite"
        >
          {status.message}
        </p>
      </form>
    </div>
  );
}
