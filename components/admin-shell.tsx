import type { ReactNode } from "react";
import { FiAlertCircle, FiCheckCircle, FiLogOut } from "react-icons/fi";
import { adminLogoutAction } from "@/app/admin/actions";
import type { AdminFlashState } from "@/app/admin/admin-ui";
import styles from "@/app/admin/page.module.css";
import AdminSidebar from "./admin-sidebar";

export type AdminShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  returnPath: string;
  flash: AdminFlashState;
  metrics?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

function AdminFlashBanners({ flash }: { flash: AdminFlashState }) {
  return (
    <>
      {flash.notice ? (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <FiCheckCircle />
          <span>{flash.notice}</span>
        </div>
      ) : null}

      {flash.warning ? (
        <div className={`${styles.banner} ${styles.bannerWarning}`}>
          <FiAlertCircle />
          <span>{flash.warning}</span>
        </div>
      ) : null}

      {flash.error ? (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <FiAlertCircle />
          <span>{flash.error}</span>
        </div>
      ) : null}
    </>
  );
}

export function AdminD1RequiredState() {
  return (
    <section className={styles.emptyState}>
      <h2>Cloudflare D1 is required for admin editing</h2>
      <p>
        Add your Cloudflare D1 environment variables before using this screen. The storefront can
        still fall back to local product data, but `/admin` only saves to D1.
      </p>
    </section>
  );
}

export default function AdminShell({
  eyebrow,
  title,
  description,
  returnPath,
  flash,
  metrics,
  actions,
  children,
}: AdminShellProps) {
  return (
    <main className={styles.page}>
      <AdminSidebar />

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p className={styles.headerCopy}>{description}</p>
          </div>

          <div className={styles.headerActions}>
            {metrics ? <div className={styles.metricRow}>{metrics}</div> : null}

            <div className={styles.headerButtonRow}>
              {actions}

              <form action={adminLogoutAction}>
                <input type="hidden" name="returnPath" value={returnPath} />
                <button type="submit" className={styles.signOutButton}>
                  <FiLogOut />
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <AdminFlashBanners flash={flash} />
        {children}
      </section>
    </main>
  );
}
