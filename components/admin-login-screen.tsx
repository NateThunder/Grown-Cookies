import { FiAlertCircle } from "react-icons/fi";
import { adminLoginAction } from "@/app/admin/actions";
import styles from "@/app/admin/page.module.css";

type AdminLoginScreenProps = {
  title: string;
  returnPath: string;
  error?: string;
  warning?: string;
  authConfigured: boolean;
};

export default function AdminLoginScreen({
  title,
  returnPath,
  error,
  warning,
  authConfigured,
}: AdminLoginScreenProps) {
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <p className={styles.loginEyebrow}>Admin access</p>
        <h1>{title}</h1>
        <p className={styles.loginCopy}>
          Use your admin account to access the Grown Cookies product studio. Repeated failed
          attempts trigger a temporary cooldown.
        </p>

        {!authConfigured ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <FiAlertCircle />
            <span>
              Authentication is not configured. Set BETTER_AUTH_SECRET.
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
            disabled={!authConfigured}
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
