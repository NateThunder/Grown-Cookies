import { cookies } from "next/headers";
import Link from "next/link";
import { FiAlertCircle, FiCheckCircle, FiLogOut } from "react-icons/fi";
import AdminLoginScreen from "@/components/admin-login-screen";
import { adminLogoutAction, updateDeliveryCostAction } from "../actions";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
import { DEFAULT_DELIVERY_COST_CENTS, getDeliveryCostSetting } from "@/lib/store-settings";
import {
  ADMIN_AUTH_COOKIE,
  getSupabaseUserFromAccessToken,
  hasSupabasePublicConfig,
  isAdminUser,
} from "@/lib/supabase/admin-auth";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

type DeliveryAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

function getFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function formatAdminDate(value?: string) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatAdminCurrency(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

export default async function DeliveryAdminPage({ searchParams }: DeliveryAdminPageProps) {
  const params = await searchParams;
  const notice = getFirstValue(params.notice);
  const warning = getFirstValue(params.warning);
  const error = getFirstValue(params.error);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const adminSessionUser = accessToken ? await getSupabaseUserFromAccessToken(accessToken) : null;
  const supabaseConfigured = hasSupabasePublicConfig();
  const adminUser = isAdminUser(adminSessionUser) ? adminSessionUser : null;

  if (!adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to manage delivery"
        returnPath="/admin/delivery"
        error={error}
        warning={warning}
        supabaseConfigured={supabaseConfigured}
      />
    );
  }

  const d1Configured = hasCloudflareD1Config();
  const deliveryCostSetting = d1Configured
    ? await getDeliveryCostSetting()
    : {
        deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
        isDefault: true,
        updatedAt: undefined,
      };

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="Grown Cookies home">
          <span className={styles.brandMain}>
            grown
            <br />
            cookies
          </span>
          <span className={styles.brandTag}>product studio</span>
        </Link>

        <nav className={styles.sidebarNav} aria-label="Admin sections">
          <Link href="/admin" className={styles.navItem}>
            Edit products
          </Link>
          <Link href="/admin?view=featured" className={styles.navItem}>
            Edit featured products
          </Link>
          <Link href="/admin/homepage" className={styles.navItem}>
            Home page
          </Link>
          <Link href="/admin/delivery" className={`${styles.navItem} ${styles.navItemActive}`.trim()}>
            Delivery costs
          </Link>
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Checkout</p>
            <h1>Delivery costs</h1>
            <p className={styles.headerCopy}>
              Update the live flat standard-delivery fee used on checkout and stored with new
              Stripe orders.
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.metricRow}>
              <div className={styles.metricCard}>
                <span>Current fee</span>
                <strong>{formatAdminCurrency(deliveryCostSetting.deliveryCostCents)}</strong>
              </div>
            </div>

            <div className={styles.headerButtonRow}>
              <form action={adminLogoutAction}>
                <input type="hidden" name="returnPath" value="/admin/delivery" />
                <button type="submit" className={styles.signOutButton}>
                  <FiLogOut />
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {notice ? (
          <div className={`${styles.banner} ${styles.bannerSuccess}`}>
            <FiCheckCircle />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        ) : null}

        {!d1Configured ? (
          <section className={styles.emptyState}>
            <h2>Cloudflare D1 is required for admin editing</h2>
            <p>
              Add your Cloudflare D1 environment variables before using this screen. The
              storefront can still fall back to local product data, but `/admin` only saves to D1.
            </p>
          </section>
        ) : (
          <section className={styles.workspace}>
            <div className={styles.workspaceStack}>
              <section className={styles.settingsPanel}>
                <div className={styles.settingsPanelHeader}>
                  <div>
                    <p className={styles.tableEyebrow}>Checkout</p>
                    <h2>Delivery fee</h2>
                  </div>
                  <p className={styles.tableHint}>
                    Set the standard delivery charge customers see during checkout.
                  </p>
                </div>

                <div className={styles.deliveryCardBody}>
                  <div className={styles.deliverySummary}>
                    <span>Current live fee</span>
                    <strong>{formatAdminCurrency(deliveryCostSetting.deliveryCostCents)}</strong>
                    <small>
                      {deliveryCostSetting.isDefault
                        ? "Using the default fee until you save a custom amount."
                        : `Last updated ${formatAdminDate(deliveryCostSetting.updatedAt)}`}
                    </small>
                  </div>

                  <form action={updateDeliveryCostAction} className={styles.deliveryForm}>
                    <input type="hidden" name="returnPath" value="/admin/delivery" />

                    <label className={styles.deliveryField}>
                      <span>Standard delivery fee</span>
                      <div className={styles.deliveryInputWrap}>
                        <span>GBP</span>
                        <input
                          name="deliveryCostValue"
                          type="text"
                          inputMode="decimal"
                          defaultValue={(deliveryCostSetting.deliveryCostCents / 100).toFixed(2)}
                          required
                        />
                      </div>
                    </label>

                    <button type="submit" className={styles.deliverySaveButton}>
                      Save delivery cost
                    </button>
                  </form>
                </div>
              </section>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
