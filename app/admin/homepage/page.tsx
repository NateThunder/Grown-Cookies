import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import {
  DEFAULT_BRAND_STORY_BODY,
  DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
  DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
  DEFAULT_COOKIE_OF_MONTH_TITLE,
  DEFAULT_SHOP_INTRO_BODY,
  DEFAULT_SHOP_INTRO_CTA_LABEL,
  DEFAULT_SHOP_INTRO_EYEBROW,
  DEFAULT_SHOP_INTRO_TITLE,
  getHomepageSectionSettings,
  type SiteLockSetting,
  type HomepageSectionSettings,
} from "@/lib/store-settings";
import { getSiteLockAdminState } from "@/lib/site-lock";
import {
  updateBrandStoryContentAction,
  updateCookieOfMonthContentAction,
  updateSiteLockAction,
  updateShopIntroContentAction,
} from "../actions";
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
  let shopIntroSetting: HomepageSectionSettings["shopIntro"] = {
    eyebrow: DEFAULT_SHOP_INTRO_EYEBROW,
    title: DEFAULT_SHOP_INTRO_TITLE,
    body: DEFAULT_SHOP_INTRO_BODY,
    ctaLabel: DEFAULT_SHOP_INTRO_CTA_LABEL,
    isDefault: true,
    updatedAt: undefined,
  };
  let brandStorySetting: HomepageSectionSettings["brandStory"] = {
    body: DEFAULT_BRAND_STORY_BODY,
    isDefault: true,
    updatedAt: undefined,
  };
  let siteLockSetting: SiteLockSetting = {
    enabled: true,
    isDefault: true,
    updatedAt: undefined,
  };

  if (context.d1Configured) {
    const [homepageSettings, persistedSiteLockSetting] = await Promise.all([
      getHomepageSectionSettings(),
      getSiteLockAdminState(),
    ]);
    cookieOfMonthSetting = homepageSettings.cookieOfMonth;
    shopIntroSetting = homepageSettings.shopIntro;
    brandStorySetting = homepageSettings.brandStory;
    siteLockSetting = persistedSiteLockSetting;
  }

  return (
    <AdminShell
      eyebrow="Homepage"
      title="Home page"
      description="Manage the homepage copy blocks for Cookie of the Month, the shop intro, and the closing brand story."
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
                  <p className={styles.tableEyebrow}>Access</p>
                  <h2>Site lock</h2>
                </div>
                <p className={styles.tableHint}>
                  Turn the public lock screen on or off. When enabled, visitors must sign in with an
                  admin account to view the main site while <code>/admin</code> stays available.
                </p>
              </div>

              <div className={styles.deliveryCardBody}>
                <div className={styles.deliverySummary}>
                  <span>Current public status</span>
                  <strong>{siteLockSetting.enabled ? "Locked" : "Open"}</strong>
                  <small>
                    {siteLockSetting.isDefault
                      ? "Following the environment default until you save a choice here."
                      : `Last updated ${formatAdminDate(siteLockSetting.updatedAt)}`}
                  </small>
                </div>

                <form action={updateSiteLockAction} className={styles.deliveryForm}>
                  <input type="hidden" name="returnPath" value="/admin/homepage" />
                  <input
                    type="hidden"
                    name="siteLockEnabled"
                    value={siteLockSetting.enabled ? "0" : "1"}
                  />

                  <button type="submit" className={styles.deliverySaveButton}>
                    {siteLockSetting.enabled ? "Disable site lock" : "Enable site lock"}
                  </button>
                </form>
              </div>
            </section>

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

            <section className={styles.settingsPanel}>
              <div className={styles.settingsPanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Homepage</p>
                  <h2>Our shop section</h2>
                </div>
                <p className={styles.tableHint}>
                  Edit the homepage intro block above the brand story section, including its label,
                  heading, body text, and button copy.
                </p>
              </div>

              <div className={styles.deliveryCardBody}>
                <div className={styles.deliverySummary}>
                  <span>Current section label</span>
                  <strong>{shopIntroSetting.eyebrow}</strong>
                  <small>
                    {shopIntroSetting.isDefault
                      ? "Using the default shop intro copy until you save changes."
                      : `Last updated ${formatAdminDate(shopIntroSetting.updatedAt)}`}
                  </small>
                </div>

                <form action={updateShopIntroContentAction} className={styles.deliveryForm}>
                  <input type="hidden" name="returnPath" value="/admin/homepage" />

                  <label className={styles.deliveryField}>
                    <span>Eyebrow</span>
                    <input
                      name="shopIntroEyebrow"
                      type="text"
                      defaultValue={shopIntroSetting.eyebrow}
                      required
                    />
                  </label>

                  <label className={styles.deliveryField}>
                    <span>Heading</span>
                    <textarea
                      name="shopIntroTitle"
                      className={styles.settingsTextarea}
                      rows={5}
                      defaultValue={shopIntroSetting.title}
                      required
                    />
                  </label>

                  <label className={styles.deliveryField}>
                    <span>Body text</span>
                    <textarea
                      name="shopIntroBody"
                      className={styles.settingsTextarea}
                      rows={6}
                      defaultValue={shopIntroSetting.body}
                      required
                    />
                  </label>

                  <label className={styles.deliveryField}>
                    <span>Button label</span>
                    <input
                      name="shopIntroCtaLabel"
                      type="text"
                      defaultValue={shopIntroSetting.ctaLabel}
                      required
                    />
                  </label>

                  <button type="submit" className={styles.deliverySaveButton}>
                    Save shop section
                  </button>
                </form>
              </div>
            </section>

            <section className={styles.settingsPanel}>
              <div className={styles.settingsPanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Homepage</p>
                  <h2>Brand story section</h2>
                </div>
                <p className={styles.tableHint}>
                  Edit the closing homepage statement shown over the final image panel.
                </p>
              </div>

              <div className={styles.deliveryCardBody}>
                <div className={styles.deliverySummary}>
                  <span>Current statement</span>
                  <strong>Homepage brand story</strong>
                  <small>
                    {brandStorySetting.isDefault
                      ? "Using the default brand story copy until you save changes."
                      : `Last updated ${formatAdminDate(brandStorySetting.updatedAt)}`}
                  </small>
                </div>

                <form action={updateBrandStoryContentAction} className={styles.deliveryForm}>
                  <input type="hidden" name="returnPath" value="/admin/homepage" />

                  <label className={styles.deliveryField}>
                    <span>Statement text</span>
                    <textarea
                      name="brandStoryBody"
                      className={styles.settingsTextarea}
                      rows={5}
                      defaultValue={brandStorySetting.body}
                      required
                    />
                  </label>

                  <button type="submit" className={styles.deliverySaveButton}>
                    Save brand story
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
