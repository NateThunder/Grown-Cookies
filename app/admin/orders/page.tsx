import { cookies } from "next/headers";
import Link from "next/link";
import { FiAlertCircle, FiCheckCircle, FiLogOut } from "react-icons/fi";
import AdminLoginScreen from "@/components/admin-login-screen";
import { getAdminOrders } from "@/lib/admin-orders";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
import {
  ADMIN_AUTH_COOKIE,
  getSupabaseUserFromAccessToken,
  hasSupabasePublicConfig,
  isAdminUser,
} from "@/lib/supabase/admin-auth";
import { adminLogoutAction, markOrderDeliveredAction } from "../actions";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

type OrdersAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

function getFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function formatAdminDateTime(value?: string) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAdminCurrency(cents: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(cents / 100);
}

function getOrderStatusClass(status: string) {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return styles.statusPending;
    case "paid":
      return styles.statusPaid;
    case "delivered":
      return styles.statusDelivered;
    case "failed":
      return styles.statusFailed;
    default:
      return styles.statusMuted;
  }
}

export default async function OrdersAdminPage({ searchParams }: OrdersAdminPageProps) {
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
        title="Sign in to manage orders"
        returnPath="/admin/orders"
        error={error}
        warning={warning}
        supabaseConfigured={supabaseConfigured}
      />
    );
  }

  const d1Configured = hasCloudflareD1Config();
  const adminOrders = d1Configured ? await getAdminOrders() : [];

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
          <Link href="/admin/orders" className={`${styles.navItem} ${styles.navItemActive}`.trim()}>
            Orders
          </Link>
          <Link href="/admin/delivery" className={styles.navItem}>
            Delivery costs
          </Link>
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Orders</p>
            <h1>Orders</h1>
            <p className={styles.headerCopy}>
              Review the latest checkout records, monitor their status, and mark paid deliveries
              complete. Pending orders warn after 2 minutes and auto-expire after 5 minutes.
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.metricRow}>
              <div className={styles.metricCard}>
                <span>Total orders</span>
                <strong>{adminOrders.length}</strong>
              </div>
            </div>

            <div className={styles.headerButtonRow}>
              <form action={adminLogoutAction}>
                <input type="hidden" name="returnPath" value="/admin/orders" />
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

        {!d1Configured ? (
          <section className={styles.emptyState}>
            <h2>Cloudflare D1 is required for admin editing</h2>
            <p>
              Add your Cloudflare D1 environment variables before using this screen. The storefront
              can still fall back to local product data, but `/admin` only saves to D1.
            </p>
          </section>
        ) : (
          <section className={styles.workspace}>
            <div className={styles.workspaceStack}>
              <div className={styles.tablePanel}>
                <div className={styles.tablePanelHeader}>
                  <div>
                    <p className={styles.tableEyebrow}>Orders</p>
                    <h2>Manage deliveries</h2>
                  </div>
                  <p className={styles.tableHint}>
                    Sellers can review live order state, spot pending orders that are nearing the
                    limit, and keep delivery completion timestamps in D1.
                  </p>
                </div>

                {adminOrders.length === 0 ? (
                  <div className={styles.ordersEmptyState}>
                    <h3>No orders yet</h3>
                    <p>Completed checkout records will appear here once the first order lands in D1.</p>
                  </div>
                ) : (
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Order</th>
                          <th scope="col">Customer</th>
                          <th scope="col">Items</th>
                          <th scope="col">Total</th>
                          <th scope="col">Status</th>
                          <th scope="col">Placed</th>
                          <th scope="col">Delivered</th>
                          <th scope="col" className={styles.actionsColumn}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminOrders.map((order) => {
                          const isDelivered = order.status.trim().toLowerCase() === "delivered";
                          const canMarkDelivered = order.status.trim().toLowerCase() === "paid";

                          return (
                            <tr key={order.orderId}>
                              <td>
                                <div className={styles.orderCell}>
                                  <strong>{order.orderId}</strong>
                                  <span>{order.deliveryAddress || "Delivery address unavailable"}</span>
                                </div>
                              </td>
                              <td>
                                <div className={styles.orderCell}>
                                  <strong>{order.customerName || "Customer details unavailable"}</strong>
                                  <span>{order.email || "Email unavailable"}</span>
                                </div>
                              </td>
                              <td>
                                <div className={styles.orderCell}>
                                  <strong>
                                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                                  </strong>
                                  <span>{order.itemsSummary || "Order items unavailable"}</span>
                                </div>
                              </td>
                              <td className={styles.priceCell}>
                                {formatAdminCurrency(order.totalCents, order.currency)}
                              </td>
                              <td>
                                <span
                                  className={`${styles.statusBadge} ${
                                    order.isPendingWarning ? styles.statusWarning : getOrderStatusClass(order.status)
                                  }`.trim()}
                                >
                                  {order.isPendingWarning ? "pending 2m+" : order.status}
                                </span>
                              </td>
                              <td>{formatAdminDateTime(order.createdAt)}</td>
                              <td>{formatAdminDateTime(order.deliveredAt)}</td>
                              <td className={styles.actionsColumn}>
                                <form action={markOrderDeliveredAction}>
                                  <input type="hidden" name="returnPath" value="/admin/orders" />
                                  <input type="hidden" name="orderId" value={order.orderId} />
                                  <button
                                    type="submit"
                                    className={`${styles.tickboxButton} ${
                                      isDelivered ? styles.tickboxButtonActive : ""
                                    }`.trim()}
                                    disabled={!canMarkDelivered && !isDelivered}
                                  >
                                    {isDelivered ? "Delivered" : canMarkDelivered ? "Mark delivered" : "Await payment"}
                                  </button>
                                </form>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
