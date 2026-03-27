import { FiAlertCircle } from "react-icons/fi";
import { adminLoginAction } from "@/app/admin/actions";
import styles from "@/app/admin/page.module.css";

type AdminLoginScreenProps = {
  title: string;
  returnPath: string;
  error?: string;
  warning?: string;
  supabaseConfigured: boolean;
};

export default function AdminLoginScreen({
  title,
  returnPath,
  error,
  warning,
  supabaseConfigured,
}: AdminLoginScreenProps) {
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <p className={styles.loginEyebrow}>Admin access</p>
        <h1>{title}</h1>
        <p className={styles.loginCopy}>
          Use your Supabase account to access the Grown Cookies product studio. Repeated failed
          attempts trigger a temporary cooldown. Enable Supabase MFA for every admin account.
        </p>

        {!supabaseConfigured ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <FiAlertCircle />
            <span>
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </span>
          </div>
        ) : null}

        {warning ? (
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <FiAlertCircle />
            <span>{warning}</span>
          </div>
        ) : null}

        {error ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        ) : null}

        <form action={adminLoginAction} className={styles.loginForm}>
          <input type="hidden" name="returnPath" value={returnPath} />

          <label className={styles.loginField}>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label className={styles.loginField}>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={!supabaseConfigured}
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
