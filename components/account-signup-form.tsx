"use client";

import { FormEvent, useState } from "react";
import { FaFacebook } from "react-icons/fa";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./account-signup-form.module.css";

type Status =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const initialStatus: Status = {
  type: "idle",
  message: "",
};

export default function AccountSignupForm() {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFacebookSubmitting, setIsFacebookSubmitting] = useState(false);

  async function handleFacebookSignup() {
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

    setIsFacebookSubmitting(true);

    const redirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/account`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo,
      },
    });

    setIsFacebookSubmitting(false);

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

    if (!firstName || !lastName || !email || !password) {
      setStatus({
        type: "error",
        message: "Complete all fields before creating an account.",
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

    const emailRedirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/account`;

    const { error } = await supabase.auth.signUp({
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

    setIsSubmitting(false);

    if (error) {
      setStatus({
        type: "error",
        message: error.message,
      });
      return;
    }

    event.currentTarget.reset();
    setStatus({
      type: "success",
      message:
        "Account created. Check your inbox to confirm your email before signing in.",
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
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
          autoComplete="new-password"
        />
      </label>

      <button className={styles.submit} type="submit" disabled={isSubmitting || isFacebookSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <button
        className={styles.facebookButton}
        type="button"
        onClick={handleFacebookSignup}
        disabled={isFacebookSubmitting || isSubmitting}
      >
        <span className={styles.facebookIconBadge} aria-hidden="true">
          <FaFacebook />
        </span>
        <span>{isFacebookSubmitting ? "Opening Facebook..." : "Continue with Facebook"}</span>
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
  );
}
