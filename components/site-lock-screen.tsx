"use client";

import { useActionState } from "react";
import { FiAlertCircle, FiLock } from "react-icons/fi";
import { siteLockLoginAction, type SiteLockActionState } from "@/app/site-lock/actions";
import styles from "./site-lock-screen.module.css";

const INITIAL_STATE: SiteLockActionState = {};

type SiteLockScreenProps = {
  returnPath: string;
};

export default function SiteLockScreen({ returnPath }: SiteLockScreenProps) {
  const [state, formAction, pending] = useActionState(siteLockLoginAction, INITIAL_STATE);

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <div className={styles.lockBadge} aria-hidden="true">
          <FiLock />
        </div>

        <p className={styles.eyebrow}>Private preview</p>
        <h1>Grown Cookies is not open to the public yet.</h1>
        <p className={styles.copy}>
          The main site is temporarily locked while launch content, products, and checkout are being
          finished. Sign in with the same admin Supabase account used for <code>/admin</code>.
        </p>

        {state.error ? (
          <div className={styles.banner}>
            <FiAlertCircle />
            <span>{state.error}</span>
          </div>
        ) : null}

        <form action={formAction} className={styles.form}>
          <input type="hidden" name="returnPath" value={returnPath} />

          <label className={styles.field}>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button type="submit" className={styles.button} disabled={pending}>
            {pending ? "Signing in..." : "Unlock site"}
          </button>
        </form>
      </section>
    </main>
  );
}
