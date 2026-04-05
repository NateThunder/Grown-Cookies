import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import { DEFAULT_DELIVERY_COST_CENTS, getDeliveryCostSetting } from "@/lib/store-settings";
import { updateDeliveryCostAction } from "../actions";
import { getAdminPageContext } from "../admin-page-context";
import { formatAdminCurrency, formatAdminDate, type SearchParamValue } from "../admin-ui";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

export default async function DeliveryAdminPage({ searchParams }: DeliveryAdminPageProps) {
  const context = await getAdminPageContext(searchParams);

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to manage delivery"
        returnPath="/admin/delivery"
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  const deliveryCostSetting = context.d1Configured
    ? await getDeliveryCostSetting()
    : {
        deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
        isDefault: true,
        updatedAt: undefined,
      };

  return (
    <AdminShell
      eyebrow="Checkout"
      title="Delivery costs"
      description="Update the live flat standard-delivery fee used on checkout and stored with new Stripe orders."
      returnPath="/admin/delivery"
      flash={context.flash}
      metrics={
        <div className={styles.metricCard}>
          <span>Current fee</span>
          <strong>{formatAdminCurrency(deliveryCostSetting.deliveryCostCents)}</strong>
        </div>
      }
    >
      {!context.d1Configured ? (
        <AdminD1RequiredState />
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
    </AdminShell>
  );
}
