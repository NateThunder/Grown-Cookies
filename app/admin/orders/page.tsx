import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import AdminOrdersTable from "@/components/admin-orders-table";
import { getAdminOrders } from "@/lib/admin-orders";
import { getAdminPageContext } from "../admin-page-context";
import { type SearchParamValue } from "../admin-ui";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrdersAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

export default async function OrdersAdminPage({ searchParams }: OrdersAdminPageProps) {
  const context = await getAdminPageContext(searchParams);

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to manage orders"
        returnPath="/admin/orders"
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  const adminOrders = context.d1Configured ? await getAdminOrders() : [];

  return (
    <AdminShell
      eyebrow="Orders"
      title="Orders"
      description="Review the latest checkout records, monitor their status, and mark paid deliveries complete. Pending orders warn after 2 minutes and auto-expire after 5 minutes."
      returnPath="/admin/orders"
      flash={context.flash}
      metrics={
        <div className={styles.metricCard}>
          <span>Total orders</span>
          <strong>{adminOrders.length}</strong>
        </div>
      }
    >
      {!context.d1Configured ? (
        <AdminD1RequiredState />
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
                <AdminOrdersTable orders={adminOrders} />
              )}
            </div>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
