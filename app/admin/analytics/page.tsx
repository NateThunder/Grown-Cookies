import Link from "next/link";
import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell from "@/components/admin-shell";
import {
  ADMIN_ANALYTICS_CUSTOM_MAX_DAYS,
  ADMIN_ANALYTICS_RANGES,
  getAdminAnalyticsDateRange,
  getCustomAdminAnalyticsDateRange,
  getAdminGoogleAnalyticsReport,
  getAdminSalesAnalytics,
  parseAdminAnalyticsRange,
  type AdminAnalyticsDateRange,
  type AdminAnalyticsRange,
  type AdminSalesAnalytics,
  type AdminSalesDailyRow,
  type AdminTrafficDailyRow,
} from "@/lib/admin-analytics";
import { getAdminPageContext } from "../admin-page-context";
import {
  formatAdminCurrency,
  getFirstSearchParamValue,
  type SearchParamValue,
} from "../admin-ui";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyticsAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

type SalesState =
  | {
      data: AdminSalesAnalytics;
      error?: undefined;
    }
  | {
      data: null;
      error?: string;
    };

type DailyAnalyticsRow = {
  date: string;
  sessions: number;
  activeUsers: number;
  pageViews: number;
  orderCount: number;
  revenueCents: number;
};

const RANGE_KEYS = Object.keys(ADMIN_ANALYTICS_RANGES) as AdminAnalyticsRange[];
const NUMBER_FORMATTER = new Intl.NumberFormat("en-GB");
const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  const roundedSeconds = Math.max(0, Math.round(seconds));

  if (roundedSeconds < 60) {
    return `${roundedSeconds}s`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return DATE_FORMATTER.format(parsed);
}

function formatDateRangeTitle(dateRange: AdminAnalyticsDateRange) {
  if (dateRange.startDate === dateRange.endDate) {
    return formatDateLabel(dateRange.startDate);
  }

  return `${formatDateLabel(dateRange.startDate)} - ${formatDateLabel(dateRange.endDate)}`;
}

function getRangeHref(range: AdminAnalyticsRange) {
  return `/admin/analytics?range=${range}`;
}

function getMergedDailyRows(
  dateRange: AdminAnalyticsDateRange,
  trafficRows: AdminTrafficDailyRow[] = [],
  salesRows: AdminSalesDailyRow[] = [],
): DailyAnalyticsRow[] {
  const trafficByDate = new Map(trafficRows.map((row) => [row.date, row]));
  const salesByDate = new Map(salesRows.map((row) => [row.date, row]));

  return [...dateRange.dateKeys].reverse().map((date) => {
    const traffic = trafficByDate.get(date);
    const sales = salesByDate.get(date);

    return {
      date,
      sessions: traffic?.sessions ?? 0,
      activeUsers: traffic?.activeUsers ?? 0,
      pageViews: traffic?.pageViews ?? 0,
      orderCount: sales?.orderCount ?? 0,
      revenueCents: sales?.revenueCents ?? 0,
    };
  });
}

function AnalyticsMetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={styles.analyticsMetricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function AnalyticsSetupNotice({
  tone,
  children,
}: {
  tone: "warning" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.banner} ${
        tone === "error" ? styles.bannerError : styles.bannerWarning
      }`.trim()}
    >
      <span>{children}</span>
    </div>
  );
}

export default async function AnalyticsAdminPage({ searchParams }: AnalyticsAdminPageProps) {
  const context = await getAdminPageContext(searchParams);
  const range = parseAdminAnalyticsRange(getFirstSearchParamValue(context.params.range));
  const customStart = getFirstSearchParamValue(context.params.start);
  const customEnd = getFirstSearchParamValue(context.params.end);
  const customDateRange = getCustomAdminAnalyticsDateRange(customStart, customEnd);
  const hasCustomRequest = Boolean(customStart || customEnd);
  const isCustomRange = Boolean(customDateRange);
  const selectedDateRange = customDateRange ?? getAdminAnalyticsDateRange(range);
  const selectedRangeTitle = isCustomRange
    ? formatDateRangeTitle(selectedDateRange)
    : ADMIN_ANALYTICS_RANGES[range].label;
  const currentAnalyticsHref = isCustomRange
    ? `/admin/analytics?start=${selectedDateRange.startDate}&end=${selectedDateRange.endDate}`
    : getRangeHref(range);

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to view analytics"
        returnPath={currentAnalyticsHref}
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  const [googleAnalyticsResult, salesState] = await Promise.all([
    getAdminGoogleAnalyticsReport(selectedDateRange),
    context.d1Configured
      ? getAdminSalesAnalytics(selectedDateRange)
          .then<SalesState>((data) => ({ data }))
          .catch<SalesState>((error) => ({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Sales analytics could not be loaded.",
          }))
      : Promise.resolve<SalesState>({ data: null }),
  ]);

  const traffic = googleAnalyticsResult.report;
  const sales = salesState.data;
  const currency = sales?.currency ?? "gbp";
  const conversionRate =
    traffic && sales && traffic.sessions > 0 ? sales.orderCount / traffic.sessions : null;
  const engagementRate =
    traffic && traffic.sessions > 0 ? traffic.engagedSessions / traffic.sessions : null;
  const dailyRows = getMergedDailyRows(
    selectedDateRange,
    traffic?.dailyTraffic,
    sales?.dailyRevenue,
  );

  return (
    <AdminShell
      eyebrow="Analytics"
      title="Analytics"
      description="Review store traffic, sales performance, top pages, and best-selling products from one admin view."
      returnPath="/admin/analytics"
      flash={context.flash}
      metrics={
        <>
          <div className={styles.metricCard}>
            <span>Sessions</span>
            <strong>{traffic ? formatNumber(traffic.sessions) : "Set up GA"}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Revenue</span>
            <strong>
              {sales ? formatAdminCurrency(sales.revenueCents, sales.currency) : "Set up D1"}
            </strong>
          </div>
          <div className={styles.metricCard}>
            <span>Orders</span>
            <strong>{sales ? formatNumber(sales.orderCount) : "Set up D1"}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Conversion</span>
            <strong>{conversionRate === null ? "Not ready" : formatPercent(conversionRate)}</strong>
          </div>
        </>
      }
    >
      <section className={styles.workspace}>
        <div className={styles.workspaceStack}>
          {googleAnalyticsResult.status !== "ok" ? (
            <AnalyticsSetupNotice tone="warning">
              {googleAnalyticsResult.message}
            </AnalyticsSetupNotice>
          ) : null}

          {!context.d1Configured ? (
            <AnalyticsSetupNotice tone="warning">
              Add Cloudflare D1 configuration to show revenue, order, and product analytics.
            </AnalyticsSetupNotice>
          ) : null}

          {salesState.error ? (
            <AnalyticsSetupNotice tone="error">{salesState.error}</AnalyticsSetupNotice>
          ) : null}

          {hasCustomRequest && !isCustomRange ? (
            <AnalyticsSetupNotice tone="warning">
              Choose a valid date range up to {ADMIN_ANALYTICS_CUSTOM_MAX_DAYS} days.
            </AnalyticsSetupNotice>
          ) : null}

          <section className={styles.settingsPanel}>
            <div className={styles.settingsPanelHeader}>
              <div>
                <p className={styles.tableEyebrow}>Overview</p>
                <h2>{selectedRangeTitle}</h2>
              </div>
              <div className={styles.analyticsRangeControls}>
                <nav className={styles.analyticsRangeNav} aria-label="Analytics date range">
                  {RANGE_KEYS.map((rangeKey) => (
                    <Link
                      key={rangeKey}
                      href={getRangeHref(rangeKey)}
                      className={`${styles.analyticsRangeLink} ${
                        !isCustomRange && rangeKey === range ? styles.analyticsRangeLinkActive : ""
                      }`.trim()}
                      aria-current={!isCustomRange && rangeKey === range ? "page" : undefined}
                    >
                      {ADMIN_ANALYTICS_RANGES[rangeKey].label.replace("Last ", "")}
                    </Link>
                  ))}
                </nav>
                <form
                  action="/admin/analytics"
                  method="get"
                  className={styles.analyticsCustomRangeForm}
                >
                  <label className={styles.analyticsCustomRangeField}>
                    <span>Start</span>
                    <input
                      type="date"
                      name="start"
                      defaultValue={selectedDateRange.startDate}
                      max={selectedDateRange.endDate}
                    />
                  </label>
                  <label className={styles.analyticsCustomRangeField}>
                    <span>End</span>
                    <input
                      type="date"
                      name="end"
                      defaultValue={selectedDateRange.endDate}
                      min={selectedDateRange.startDate}
                    />
                  </label>
                  <button type="submit" className={styles.analyticsCustomRangeButton}>
                    Apply
                  </button>
                </form>
              </div>
            </div>

            <div className={styles.analyticsMetricGrid}>
              <AnalyticsMetricCard
                label="Active users"
                value={traffic ? formatNumber(traffic.activeUsers) : "Unavailable"}
              />
              <AnalyticsMetricCard
                label="Page views"
                value={traffic ? formatNumber(traffic.pageViews) : "Unavailable"}
              />
              <AnalyticsMetricCard
                label="Engagement"
                value={engagementRate === null ? "Unavailable" : formatPercent(engagementRate)}
              />
              <AnalyticsMetricCard
                label="Avg session"
                value={
                  traffic
                    ? formatDuration(traffic.averageSessionDurationSeconds)
                    : "Unavailable"
                }
              />
              <AnalyticsMetricCard
                label="Revenue"
                value={
                  sales ? formatAdminCurrency(sales.revenueCents, sales.currency) : "Unavailable"
                }
              />
              <AnalyticsMetricCard
                label="Average order"
                value={
                  sales
                    ? formatAdminCurrency(sales.averageOrderValueCents, sales.currency)
                    : "Unavailable"
                }
              />
              <AnalyticsMetricCard
                label="Items sold"
                value={sales ? formatNumber(sales.itemsSold) : "Unavailable"}
              />
              <AnalyticsMetricCard
                label="Tips"
                value={sales ? formatAdminCurrency(sales.tipCents, sales.currency) : "Unavailable"}
              />
            </div>
          </section>

          <section className={styles.tablePanel}>
            <div className={styles.tablePanelHeader}>
              <div>
                <p className={styles.tableEyebrow}>Daily trend</p>
                <h2>Traffic and sales by day</h2>
              </div>
              <p className={styles.tableHint}>
                Completed orders include paid and delivered checkout records.
              </p>
            </div>
            <div className={styles.tableScroll}>
              <table className={`${styles.table} ${styles.analyticsTable}`.trim()}>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Sessions</th>
                    <th scope="col">Users</th>
                    <th scope="col">Page views</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((row) => (
                    <tr key={row.date}>
                      <td>{formatDateLabel(row.date)}</td>
                      <td>{traffic ? formatNumber(row.sessions) : "Unavailable"}</td>
                      <td>{traffic ? formatNumber(row.activeUsers) : "Unavailable"}</td>
                      <td>{traffic ? formatNumber(row.pageViews) : "Unavailable"}</td>
                      <td>{sales ? formatNumber(row.orderCount) : "Unavailable"}</td>
                      <td>
                        {sales ? formatAdminCurrency(row.revenueCents, currency) : "Unavailable"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.analyticsTwoColumn}>
            <section className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Traffic</p>
                  <h2>Top pages</h2>
                </div>
              </div>
              {traffic && traffic.topPages.length > 0 ? (
                <div className={styles.tableScroll}>
                  <table className={`${styles.table} ${styles.analyticsTable}`.trim()}>
                    <thead>
                      <tr>
                        <th scope="col">Page</th>
                        <th scope="col">Views</th>
                        <th scope="col">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.topPages.map((page) => (
                        <tr key={`${page.path}-${page.title}`}>
                          <td>
                            <div className={styles.orderCell}>
                              <strong>{page.title}</strong>
                              <span>{page.path}</span>
                            </div>
                          </td>
                          <td>{formatNumber(page.pageViews)}</td>
                          <td>{formatNumber(page.activeUsers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.analyticsEmptyState}>No page traffic available.</div>
              )}
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Sales</p>
                  <h2>Top products</h2>
                </div>
              </div>
              {sales && sales.topProducts.length > 0 ? (
                <div className={styles.tableScroll}>
                  <table className={`${styles.table} ${styles.analyticsTable}`.trim()}>
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Qty</th>
                        <th scope="col">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.topProducts.map((product) => (
                        <tr key={`${product.slug}-${product.name}`}>
                          <td>
                            <div className={styles.orderCell}>
                              <strong>{product.name}</strong>
                              <span>{product.slug || "No product slug"}</span>
                            </div>
                          </td>
                          <td>{formatNumber(product.quantity)}</td>
                          <td>{formatAdminCurrency(product.revenueCents, sales.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.analyticsEmptyState}>No completed product sales available.</div>
              )}
            </section>
          </div>

          <div className={styles.analyticsThreeColumn}>
            <section className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Traffic</p>
                  <h2>Sources</h2>
                </div>
              </div>
              {traffic && traffic.topSources.length > 0 ? (
                <div className={styles.analyticsBreakdownList}>
                  {traffic.topSources.map((source) => (
                    <div key={source.label} className={styles.analyticsBreakdownItem}>
                      <span>{source.label}</span>
                      <strong>{formatNumber(source.sessions)} sessions</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.analyticsEmptyState}>No source data available.</div>
              )}
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Traffic</p>
                  <h2>Devices</h2>
                </div>
              </div>
              {traffic && traffic.devices.length > 0 ? (
                <div className={styles.analyticsBreakdownList}>
                  {traffic.devices.map((device) => (
                    <div key={device.label} className={styles.analyticsBreakdownItem}>
                      <span>{device.label}</span>
                      <strong>{formatNumber(device.sessions)} sessions</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.analyticsEmptyState}>No device data available.</div>
              )}
            </section>

            <section className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Traffic</p>
                  <h2>Countries</h2>
                </div>
              </div>
              {traffic && traffic.countries.length > 0 ? (
                <div className={styles.analyticsBreakdownList}>
                  {traffic.countries.map((country) => (
                    <div key={country.label} className={styles.analyticsBreakdownItem}>
                      <span>{country.label}</span>
                      <strong>{formatNumber(country.sessions)} sessions</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.analyticsEmptyState}>No country data available.</div>
              )}
            </section>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
