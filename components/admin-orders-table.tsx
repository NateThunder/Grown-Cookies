"use client";

import { useEffect, useState } from "react";
import type { AdminOrderSummary } from "@/lib/admin-orders";
import { markOrderDeliveredAction } from "@/app/admin/actions";
import { formatAdminCurrency, formatAdminDateTime } from "@/app/admin/admin-ui";
import styles from "@/app/admin/page.module.css";

type AdminOrdersTableProps = {
  orders: AdminOrderSummary[];
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

function getOrderItemSubtotal(lineTotalCents: number, unitPriceCents: number, quantity: number) {
  if (lineTotalCents > 0) {
    return lineTotalCents;
  }

  return unitPriceCents * quantity;
}

export default function AdminOrdersTable({ orders }: AdminOrdersTableProps) {
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const selectedOrder = orders.find((order) => order.orderId === selectedOrderId) ?? null;

  useEffect(() => {
    if (!selectedOrder) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedOrderId("");
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedOrder]);

  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Product</th>
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
            {orders.map((order) => (
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
                    <span>{order.itemsSummary || "Order items unavailable"}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.orderCell}>
                    <strong>
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </strong>
                  </div>
                </td>
                <td className={styles.priceCell}>{formatAdminCurrency(order.totalCents, order.currency)}</td>
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
                  <button
                    type="button"
                    className={styles.orderDetailsSummary}
                    onClick={() => setSelectedOrderId(order.orderId)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setSelectedOrderId("")}
        >
          <div
            className={`${styles.modalCard} ${styles.orderDetailsModal}`.trim()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>Order details</p>
                <h2 id="order-details-title">{selectedOrder.orderId}</h2>
                <p>
                  Review customer, delivery, and item details, then mark the order delivered once it has
                  reached the customer.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close order details"
                onClick={() => setSelectedOrderId("")}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.orderDetailsCard}>
                <div className={styles.orderDetailsGrid}>
                  <section className={styles.orderDetailsSection}>
                    <p className={styles.orderDetailsLabel}>Customer</p>
                    <p>{selectedOrder.customerName || "Customer details unavailable"}</p>
                    <p>{selectedOrder.email || "Email unavailable"}</p>
                  </section>

                  <section className={styles.orderDetailsSection}>
                    <p className={styles.orderDetailsLabel}>Delivery</p>
                    <p>{selectedOrder.addressLine1 || "Address line 1 unavailable"}</p>
                    {selectedOrder.addressLine2 ? <p>{selectedOrder.addressLine2}</p> : null}
                    <p>
                      {[selectedOrder.city, selectedOrder.postcode].filter(Boolean).join(", ") ||
                        "City/postcode unavailable"}
                    </p>
                    <p>{selectedOrder.country || "Country unavailable"}</p>
                  </section>

                  <section className={styles.orderDetailsSection}>
                    <p className={styles.orderDetailsLabel}>Order</p>
                    <p>Placed: {formatAdminDateTime(selectedOrder.createdAt)}</p>
                    <p>Delivered: {formatAdminDateTime(selectedOrder.deliveredAt)}</p>
                    <p>Total: {formatAdminCurrency(selectedOrder.totalCents, selectedOrder.currency)}</p>
                  </section>
                </div>

                <section className={styles.orderDetailsSection}>
                  <p className={styles.orderDetailsLabel}>Items</p>
                  {selectedOrder.items.length > 0 ? (
                    <div className={styles.orderLineItemList}>
                      {selectedOrder.items.map((item, index) => (
                        <div
                          key={`${selectedOrder.orderId}-${item.slug || item.name}-${index}`}
                          className={styles.orderLineItem}
                        >
                          <div className={styles.orderCell}>
                            <strong>{item.name}</strong>
                            <span>
                              Qty {item.quantity}
                              {item.unitPriceCents > 0
                                ? ` at ${formatAdminCurrency(item.unitPriceCents, selectedOrder.currency)} each`
                                : ""}
                            </span>
                          </div>
                          <strong className={styles.priceCell}>
                            {formatAdminCurrency(
                              getOrderItemSubtotal(item.lineTotalCents, item.unitPriceCents, item.quantity),
                              selectedOrder.currency,
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Order items unavailable.</p>
                  )}
                </section>

                <form action={markOrderDeliveredAction} className={styles.tickboxForm}>
                  <input type="hidden" name="returnPath" value="/admin/orders" />
                  <input type="hidden" name="orderId" value={selectedOrder.orderId} />
                  <button
                    type="submit"
                    className={`${styles.tickboxButton} ${
                      selectedOrder.status.trim().toLowerCase() === "delivered" ? styles.tickboxButtonActive : ""
                    }`.trim()}
                    disabled={
                      selectedOrder.status.trim().toLowerCase() !== "paid" &&
                      selectedOrder.status.trim().toLowerCase() !== "delivered"
                    }
                  >
                    {selectedOrder.status.trim().toLowerCase() === "delivered"
                      ? "Delivered"
                      : selectedOrder.status.trim().toLowerCase() === "paid"
                        ? "Mark delivered"
                        : "Await payment"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
