import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import { getAdminOrders } from "@/lib/admin-orders";
import { markOrderDeliveredAction } from "../actions";
import { getAdminPageContext } from "../admin-page-context";
import {
  formatAdminCurrency,
  formatAdminDateTime,
  type SearchParamValue,
} from "../admin-ui";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrdersAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

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
    </AdminShell>
  );
}
