import { cookies } from "next/headers";
import Link from "next/link";
import { FiAlertCircle, FiCheckCircle, FiLogOut } from "react-icons/fi";
import AdminLoginScreen from "@/components/admin-login-screen";
import {
  adminLogoutAction,
  updateBrandStoryContentAction,
  updateCookieOfMonthContentAction,
  updateShopIntroContentAction,
} from "../actions";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
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
  type HomepageSectionSettings,
} from "@/lib/store-settings";
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

type HomepageAdminPageProps = {
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

export default async function HomepageAdminPage({ searchParams }: HomepageAdminPageProps) {
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
        title="Sign in to manage homepage content"
        returnPath="/admin/homepage"
        error={error}
        warning={warning}
        supabaseConfigured={supabaseConfigured}
      />
    );
  }

  const d1Configured = hasCloudflareD1Config();
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

  if (d1Configured) {
    const homepageSettings = await getHomepageSectionSettings();
    cookieOfMonthSetting = homepageSettings.cookieOfMonth;
    shopIntroSetting = homepageSettings.shopIntro;
    brandStorySetting = homepageSettings.brandStory;
  }

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
          <Link href="/admin/homepage" className={`${styles.navItem} ${styles.navItemActive}`.trim()}>
            Home page
          </Link>
          <Link href="/admin/delivery" className={styles.navItem}>
            Delivery costs
          </Link>
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Homepage</p>
            <h1>Home page</h1>
            <p className={styles.headerCopy}>
              Manage the homepage copy blocks for Cookie of the Month, the shop intro, and the
              closing brand story.
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.headerButtonRow}>
              <form action={adminLogoutAction}>
                <input type="hidden" name="returnPath" value="/admin/homepage" />
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
      </section>
    </main>
  );
}
