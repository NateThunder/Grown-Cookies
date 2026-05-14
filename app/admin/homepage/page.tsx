import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import {
  DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
  DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
  DEFAULT_COOKIE_OF_MONTH_TITLE,
  getHomepageSectionSettings,
  type HomepageSectionSettings,
} from "@/lib/store-settings";
import { updateCookieOfMonthContentAction } from "../actions";
import { getAdminPageContext } from "../admin-page-context";
import { formatAdminDate, type SearchParamValue } from "../admin-ui";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HomepageAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

export default async function HomepageAdminPage({ searchParams }: HomepageAdminPageProps) {
  const context = await getAdminPageContext(searchParams);

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to manage homepage content"
        returnPath="/admin/homepage"
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  let cookieOfMonthSetting: HomepageSectionSettings["cookieOfMonth"] = {
    title: DEFAULT_COOKIE_OF_MONTH_TITLE,
    ctaLabel: DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
    productSlug: DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
    isDefault: true,
    updatedAt: undefined,
  };

  if (context.d1Configured) {
    const homepageSettings = await getHomepageSectionSettings();
    cookieOfMonthSetting = homepageSettings.cookieOfMonth;
  }

  return (
    <AdminShell
      eyebrow="Homepage"
      title="Home page"
      description="Manage the homepage copy block for Cookie of the Month."
      returnPath="/admin/homepage"
      flash={context.flash}
    >
      {!context.d1Configured ? (
        <AdminD1RequiredState />
      ) : (
        <section className={styles.workspace}>
          <div className={styles.workspaceStack}>
            <section className={styles.settingsPanel}>
              <div className={styles.settingsPanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Homepage</p>
                  <h2>Cookie of the Month section</h2>
                </div>
                <p className={styles.tableHint}>
                  Edit the homepage copy here. Pick the linked product from the products table on
                  the products page with the Cookie of the Month tick box.
                </p>
              </div>

              <div className={styles.deliveryCardBody}>
                <div className={styles.deliverySummary}>
                  <span>Current product</span>
                  <strong>{cookieOfMonthSetting.productSlug ?? "Not selected"}</strong>
                  <small>
                    {cookieOfMonthSetting.isDefault
                      ? "Using the default section copy until you save changes."
                      : `Last updated ${formatAdminDate(cookieOfMonthSetting.updatedAt)}`}
                  </small>
                </div>

                <form action={updateCookieOfMonthContentAction} className={styles.deliveryForm}>
                  <input type="hidden" name="returnPath" value="/admin/homepage" />

                  <label className={styles.deliveryField}>
                    <span>Section text</span>
                    <textarea
                      name="cookieOfMonthTitle"
                      className={styles.settingsTextarea}
                      rows={4}
                      defaultValue={cookieOfMonthSetting.title}
                      required
                    />
                  </label>

                  <label className={styles.deliveryField}>
                    <span>Button label</span>
                    <input
                      name="cookieOfMonthCtaLabel"
                      type="text"
                      defaultValue={cookieOfMonthSetting.ctaLabel}
                      required
                    />
                  </label>

                  <button type="submit" className={styles.deliverySaveButton}>
                    Save section text
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
