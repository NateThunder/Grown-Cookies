import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import {
  DEFAULT_DELIVERY_COST_CENTS,
  getDeliveryCostSetting,
  getDispatchSettings,
} from "@/lib/store-settings";
import { formatDispatchDate } from "@/lib/dispatch";
import { getAvailableDispatchDatesWithHolidayExclusions } from "@/lib/dispatch-availability";
import { updateDeliveryCostAction, updateDispatchSettingsAction } from "../actions";
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
  const dispatchSettings = context.d1Configured ? await getDispatchSettings() : undefined;
  const dispatchPreviewDates = dispatchSettings
    ? await getAvailableDispatchDatesWithHolidayExclusions(dispatchSettings, { limit: 8 })
    : [];
  const weekdayOptions = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  return (
    <AdminShell
      eyebrow="Checkout"
      title="Delivery"
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
                      <span>£</span>
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

            {dispatchSettings ? (
              <section className={styles.settingsPanel}>
                <div className={styles.settingsPanelHeader}>
                  <div>
                    <p className={styles.tableEyebrow}>Dispatch</p>
                    <h2>Dispatch availability</h2>
                  </div>
                  <p className={styles.tableHint}>
                    Control the dispatch dates customers can choose from the cart.
                  </p>
                </div>

                <div className={styles.deliveryCardBody}>
                  <div className={styles.deliverySummary}>
                    <span>Next dispatch dates</span>
                    <strong>{dispatchPreviewDates[0] ? formatDispatchDate(dispatchPreviewDates[0]) : "None"}</strong>
                    <small>
                      {dispatchPreviewDates.length > 1
                        ? dispatchPreviewDates.slice(1, 4).map(formatDispatchDate).join(", ")
                        : "No other dates are currently available."}
                    </small>
                  </div>

                  <form action={updateDispatchSettingsAction} className={styles.deliveryForm}>
                    <input type="hidden" name="returnPath" value="/admin/delivery" />

                    <fieldset className={styles.deliveryFieldset}>
                      <legend>Dispatch weekdays</legend>
                      <div className={styles.dispatchWeekdayGrid}>
                        {weekdayOptions.map((day) => (
                          <label key={day.value} className={styles.dispatchWeekdayOption}>
                            <input
                              type="checkbox"
                              name="dispatchWeekdays"
                              value={day.value}
                              defaultChecked={dispatchSettings.enabledWeekdays.includes(day.value)}
                            />
                            <span>{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <label className={styles.dispatchToggle}>
                      <input
                        type="checkbox"
                        name="sameDayEnabled"
                        value="1"
                        defaultChecked={dispatchSettings.sameDayEnabled}
                      />
                      <span>Allow same-day dispatch until the cutoff time</span>
                    </label>

                    <div className={styles.deliveryFormGrid}>
                      <label className={styles.deliveryField}>
                        <span>Cutoff time</span>
                        <input
                          name="cutoffTime"
                          type="time"
                          defaultValue={dispatchSettings.cutoffTime}
                          required
                        />
                      </label>

                      <label className={styles.deliveryField}>
                        <span>Minimum prep days</span>
                        <input
                          name="minimumPrepDays"
                          type="number"
                          min="0"
                          max="30"
                          defaultValue={dispatchSettings.minimumPrepDays}
                          required
                        />
                      </label>

                      <label className={styles.deliveryField}>
                        <span>Booking horizon days</span>
                        <input
                          name="bookingHorizonDays"
                          type="number"
                          min="1"
                          max="180"
                          defaultValue={dispatchSettings.bookingHorizonDays}
                          required
                        />
                      </label>
                    </div>

                    <button type="submit" className={styles.deliverySaveButton}>
                      Save dispatch settings
                    </button>
                  </form>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
