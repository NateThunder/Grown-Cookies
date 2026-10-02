"use client";

import { FormEvent, useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth/client";
import { getAuthUserDisplayName, type AppAuthUser } from "@/lib/auth/types";
import styles from "./account-signup-form.module.css";

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

function getRecoveryState() {
  if (typeof window === "undefined") {
    return { requested: false, token: "", error: "" };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return {
    requested: Boolean(searchParams.get("token") || searchParams.get("error")),
    token: searchParams.get("token") ?? "",
    error: searchParams.get("error") ?? "",
  };
}

export default function AccountSignupForm() {
  const { data: authSession } = useSession();
  const session = authSession?.session ?? null;
  const user = (authSession?.user as AppAuthUser | undefined) ?? null;
  const [mode, setMode] = useState<AuthMode>("signup");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isRecoveryPasswordVisible, setIsRecoveryPasswordVisible] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");

  useEffect(() => {
    const recovery = getRecoveryState();

    if (recovery.requested && recovery.token) {
      setIsRecoveryMode(true);
      setRecoveryToken(recovery.token);
    }

    if (recovery.error) {
      setStatus({
        type: "error",
        message: "This password reset link is invalid or has expired. Request a new reset email.",
      });
    }
  }, []);

  const displayName = getAuthUserDisplayName(user) || "Customer";

  async function handleSignOut() {
    setStatus(initialStatus);

    setIsSigningOut(true);
    const { error } = await authClient.signOut();

    setIsSigningOut(false);

    if (error) {
      setStatus({
        type: "error",
        message: error.message || "Sign out failed. Please try again.",
      });
      return;
    }

    setStatus({
      type: "success",
      message: "You have been signed out.",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(initialStatus);
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password || (mode === "signup" && (!trimmedFirstName || !trimmedLastName))) {
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

    setIsSubmitting(true);

    let error: string | null = null;

    if (mode === "signup") {
      const emailRedirectTo = getCanonicalAccountRedirectUrl();

      const response = await authClient.signUp.email({
        email: trimmedEmail,
        password,
        name: `${trimmedFirstName} ${trimmedLastName}`,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        callbackURL: emailRedirectTo,
      });

      if (response.error) {
        error = response.error.message || "Account creation failed. Please try again.";
      } else {
        setStatus({
          type: "success",
          message:
            "Account created. Check your inbox to confirm your email before signing in.",
        });
      }
    } else {
      const response = await authClient.signIn.email({
        email: trimmedEmail,
        password,
        rememberMe: true,
      });

      if (response.error) {
        error = response.error.message || "Sign in failed. Check your email and password.";
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
  }

  async function handleForgotPassword() {
    setStatus(initialStatus);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setStatus({
        type: "error",
        message: "Enter your email address first so we know where to send the reset link.",
      });
      return;
    }

    setIsRequestingReset(true);

    const { error } = await authClient.requestPasswordReset({
      email: trimmedEmail,
      redirectTo: getCanonicalAccountRedirectUrl(),
    });

    setIsRequestingReset(false);

    if (error) {
      setStatus({
        type: "error",
        message: error.message || "We could not send the reset email. Please try again.",
      });
      return;
    }

    setStatus({
      type: "success",
      message:
        "Password reset email sent. Check your inbox and spam folder, then open the link to set a new password.",
    });
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(initialStatus);

    if (!newPassword || !confirmPassword) {
      setStatus({
        type: "error",
        message: "Enter and confirm your new password.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setStatus({
        type: "error",
        message: "Use a password with at least 8 characters.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({
        type: "error",
        message: "Your password confirmation does not match.",
      });
      return;
    }

    setIsResettingPassword(true);

    const { error } = await authClient.resetPassword({
      newPassword,
      token: recoveryToken,
    });

    setIsResettingPassword(false);

    if (error) {
      setStatus({
        type: "error",
        message: error.message || "We could not reset your password. Please request a new link.",
      });
      return;
    }

    setIsRecoveryMode(false);
    setRecoveryToken("");
    setNewPassword("");
    setConfirmPassword("");
    setIsRecoveryPasswordVisible(false);
    setStatus({
      type: "success",
      message: "Password updated successfully. You can continue in your account.",
    });
  }

  if (session && user && !isRecoveryMode) {
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

  if (isRecoveryMode) {
    return (
      <div className={`${styles.authCard} whiteFrame`}>
        <div className={styles.recoveryIntro}>
          <p className={styles.accountEyebrow}>Password reset</p>
          <h3>Set your new password</h3>
          <p>Choose a new password for your Grown Cookies account to finish recovery.</p>
        </div>

        <form className={styles.form} onSubmit={handlePasswordReset}>
          <label className={styles.field}>
            <span>New password</span>
            <div className={styles.passwordField}>
              <input
                name="newPassword"
                type={isRecoveryPasswordVisible ? "text" : "password"}
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setIsRecoveryPasswordVisible((current) => !current)}
                aria-label={isRecoveryPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isRecoveryPasswordVisible}
              >
                {isRecoveryPasswordVisible ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 4.5 19.5 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.2 0 9.4 3.6 10.8 7-0.7 1.8-2.1 3.6-4 4.9M6.7 6.8C4.7 8 3.3 9.8 2.5 12c1.4 3.4 5.6 7 10.8 7 1.5 0 2.9-.3 4.1-.8"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M2.5 12C3.9 8.6 8.1 5 13.3 5s9.4 3.6 10.8 7c-1.4 3.4-5.6 7-10.8 7S3.9 15.4 2.5 12Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="13.3"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <label className={styles.field}>
            <span>Confirm new password</span>
            <div className={styles.passwordField}>
              <input
                name="confirmPassword"
                type={isRecoveryPasswordVisible ? "text" : "password"}
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setIsRecoveryPasswordVisible((current) => !current)}
                aria-label={isRecoveryPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isRecoveryPasswordVisible}
              >
                {isRecoveryPasswordVisible ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 4.5 19.5 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.2 0 9.4 3.6 10.8 7-0.7 1.8-2.1 3.6-4 4.9M6.7 6.8C4.7 8 3.3 9.8 2.5 12c1.4 3.4 5.6 7 10.8 7 1.5 0 2.9-.3 4.1-.8"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M2.5 12C3.9 8.6 8.1 5 13.3 5s9.4 3.6 10.8 7c-1.4 3.4-5.6 7-10.8 7S3.9 15.4 2.5 12Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="13.3"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button className={styles.submit} type="submit" disabled={isResettingPassword}>
            {isResettingPassword ? "Updating password..." : "Update password"}
          </button>

          <button
            type="button"
            className={styles.textAction}
            onClick={() => {
              setIsRecoveryMode(false);
              setNewPassword("");
              setConfirmPassword("");
              setStatus(initialStatus);
            }}
          >
            Back to sign in
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

  return (
    <div className={`${styles.authCard} whiteFrame`}>
      <div className={styles.modeSwitch} role="tablist" aria-label="Account access">
        <button
          type="button"
          className={`${styles.modeButton} ${mode === "signup" ? styles.modeButtonActive : ""}`.trim()}
          onClick={() => {
            setMode("signup");
            setStatus(initialStatus);
            setIsPasswordVisible(false);
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
            setIsPasswordVisible(false);
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
              <input
                name="firstName"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Last name</span>
              <input
                name="lastName"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <label className={styles.field}>
          <span>Email address</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <div className={styles.passwordField}>
            <input
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setIsPasswordVisible((current) => !current)}
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              aria-pressed={isPasswordVisible}
            >
              {isPasswordVisible ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5 19.5 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.2 0 9.4 3.6 10.8 7-0.7 1.8-2.1 3.6-4 4.9M6.7 6.8C4.7 8 3.3 9.8 2.5 12c1.4 3.4 5.6 7 10.8 7 1.5 0 2.9-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2.5 12C3.9 8.6 8.1 5 13.3 5s9.4 3.6 10.8 7c-1.4 3.4-5.6 7-10.8 7S3.9 15.4 2.5 12Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="13.3"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
          </div>
        </label>

        {mode === "signin" ? (
          <button
            type="button"
            className={styles.textAction}
            onClick={() => void handleForgotPassword()}
            disabled={isRequestingReset || isSubmitting}
          >
            {isRequestingReset ? "Sending reset link..." : "Forgot password?"}
          </button>
        ) : null}

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "signup"
              ? "Creating account..."
              : "Signing in..."
            : mode === "signup"
              ? "Create account"
            : "Sign in"}
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
