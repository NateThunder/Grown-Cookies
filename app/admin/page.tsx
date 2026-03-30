import Image from "next/image";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiChevronUp,
  FiImage,
  FiLogOut,
  FiPlus,
  FiStar,
  FiX,
} from "react-icons/fi";
import AdminLoginScreen from "@/components/admin-login-screen";
import AdminProductForm from "@/components/admin-product-form";
import { getAdminOrders } from "@/lib/admin-orders";
import {
  adminLogoutAction,
  moveFeaturedProductAction,
  updateCookieOfMonthProductAction,
} from "./actions";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
import { hasCloudflareR2UploadConfig } from "@/lib/cloudflare-r2";
import { getAdminProducts } from "@/lib/product-admin";
import {
  DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
  DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
  DEFAULT_COOKIE_OF_MONTH_TITLE,
  DEFAULT_DELIVERY_COST_CENTS,
  getCookieOfMonthSectionSetting,
  getDeliveryCostSetting,
} from "@/lib/store-settings";
import {
  ADMIN_AUTH_COOKIE,
  getSupabaseUserFromAccessToken,
  hasSupabasePublicConfig,
  isAdminUser,
} from "@/lib/supabase/admin-auth";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

type AdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

type AdminView = "all" | "featured";

function getFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function getAdminHref({
  view,
  productSlug,
  createNew,
}: {
  view: AdminView;
  productSlug?: string;
  createNew?: boolean;
}) {
  const searchParams = new URLSearchParams();

  if (view === "featured") {
    searchParams.set("view", "featured");
  }

  if (productSlug) {
    searchParams.set("product", productSlug);
  }

  if (createNew) {
    searchParams.set("new", "1");
  }

  return `/admin${searchParams.size ? `?${searchParams.toString()}` : ""}`;
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

function formatAdminCurrency(cents: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(cents / 100);
}
export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const view: AdminView = getFirstValue(params.view) === "featured" ? "featured" : "all";
  const showingFeaturedOnly = view === "featured";
  const selectedSlug = getFirstValue(params.product);
  const createNew = getFirstValue(params.new) === "1";
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
        title="Sign in to manage products"
        returnPath="/admin"
        error={error}
        warning={warning}
        supabaseConfigured={supabaseConfigured}
      />
    );
  }

  const d1Configured = hasCloudflareD1Config();
  const uploadEnabled = hasCloudflareR2UploadConfig();
  let products: Awaited<ReturnType<typeof getAdminProducts>> = [];
  let adminOrders: Awaited<ReturnType<typeof getAdminOrders>> = [];
  let deliveryCostSetting: Awaited<ReturnType<typeof getDeliveryCostSetting>> = {
    deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
    isDefault: true,
    updatedAt: undefined,
  };
  let cookieOfMonthSetting: Awaited<ReturnType<typeof getCookieOfMonthSectionSetting>> = {
    title: DEFAULT_COOKIE_OF_MONTH_TITLE,
    ctaLabel: DEFAULT_COOKIE_OF_MONTH_CTA_LABEL,
    productSlug: DEFAULT_COOKIE_OF_MONTH_PRODUCT_SLUG,
    isDefault: true,
    updatedAt: undefined,
  };

  if (d1Configured) {
    [products, adminOrders, deliveryCostSetting, cookieOfMonthSetting] = await Promise.all([
      getAdminProducts(),
      getAdminOrders(),
      getDeliveryCostSetting(),
      getCookieOfMonthSectionSetting(),
    ]);
  }

  const nextSortOrder =
    products.reduce((highestSortOrder, product) => Math.max(highestSortOrder, product.sortOrder), 0) +
    1;
  const nextFeaturedPosition =
    products.reduce(
      (highestFeaturedPosition, product) =>
        Math.max(highestFeaturedPosition, product.featuredPosition ?? 0),
      0,
    ) + 1;
  const featuredProducts = products
    .filter((product) => product.featured)
    .sort((left, right) => {
      const leftPosition = left.featuredPosition ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = right.featuredPosition ?? Number.MAX_SAFE_INTEGER;

      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }

      return left.name.localeCompare(right.name);
    });
  const visibleProducts = showingFeaturedOnly ? featuredProducts : products;
  const selectedProduct = selectedSlug
    ? products.find((product) => product.slug === selectedSlug)
    : undefined;
  const isEditorOpen = createNew || Boolean(selectedProduct);

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
          <Link
            href={getAdminHref({ view: "all" })}
            className={`${styles.navItem} ${!showingFeaturedOnly ? styles.navItemActive : ""}`.trim()}
          >
            Edit products
          </Link>
          <Link
            href={getAdminHref({ view: "featured" })}
            className={`${styles.navItem} ${showingFeaturedOnly ? styles.navItemActive : ""}`.trim()}
          >
            Edit featured products
          </Link>
          <Link href="/admin/homepage" className={styles.navItem}>
            Home page
          </Link>
          <Link href="/admin/orders" className={styles.navItem}>
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
            <p className={styles.eyebrow}>{showingFeaturedOnly ? "Homepage" : "Catalogue"}</p>
            <h1>{showingFeaturedOnly ? "Featured products" : "Products"}</h1>
            <p className={styles.headerCopy}>
              {showingFeaturedOnly
                ? "Adjust which products appear on the homepage and their display order."
                : "Keep the product list, homepage picks, and product images in sync from one place."}
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.metricRow}>
              <Link href={getAdminHref({ view: "all" })} className={styles.metricCardLink}>
                <span>Total products</span>
                <strong>{products.length}</strong>
              </Link>
              <Link href="/admin/orders" className={styles.metricCardLink}>
                <span>Orders</span>
                <strong>{adminOrders.length}</strong>
              </Link>
              <Link href={getAdminHref({ view: "featured" })} className={styles.metricCardLink}>
                <span>Featured</span>
                <strong>{featuredProducts.length}</strong>
              </Link>
              <Link href="/admin/delivery" className={styles.metricCardLink}>
                <span>Delivery fee</span>
                <strong>{formatAdminCurrency(deliveryCostSetting.deliveryCostCents)}</strong>
              </Link>
            </div>

            <div className={styles.headerButtonRow}>
              <Link href={getAdminHref({ view, createNew: true })} className={styles.addButton}>
                <FiPlus />
                <span>Add product</span>
              </Link>

              <form action={adminLogoutAction}>
                <input type="hidden" name="returnPath" value="/admin" />
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
              Add your Cloudflare D1 environment variables before using this screen. The
              storefront can still fall back to local product data, but `/admin` only saves to D1.
            </p>
          </section>
        ) : (
          <section className={styles.workspace}>
            <div className={styles.workspaceStack}>
              <div className={styles.tablePanel}>
                <div className={styles.tablePanelHeader}>
                  <div>
                    <p className={styles.tableEyebrow}>
                      {showingFeaturedOnly ? "Featured list" : "Product list"}
                    </p>
                    <h2>{showingFeaturedOnly ? "Manage featured products" : "Manage all products"}</h2>
                  </div>
                  <p className={styles.tableHint}>
                    {showingFeaturedOnly
                      ? "Only products in the homepage featured list are shown here, ordered by homepage position."
                      : "Click edit to open a pop-out window. The thumbnail, featured status, and dates are shown here for quick scanning."}
                  </p>
                </div>

                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Price</th>
                        <th scope="col">Featured</th>
                        <th scope="col">Cookie of month</th>
                        <th scope="col">Added</th>
                        <th scope="col">Updated</th>
                        <th scope="col" className={styles.actionsColumn}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product, index) => {
                        const isActive = !createNew && selectedProduct?.slug === product.slug;
                        const isFirstFeatured = showingFeaturedOnly && index === 0;
                        const isLastFeatured = showingFeaturedOnly && index === visibleProducts.length - 1;

                        return (
                          <tr key={product.slug} className={isActive ? styles.activeRow : undefined}>
                            <td>
                              <div className={styles.productCell}>
                                <div className={styles.productThumb}>
                                  {product.imageUrl ? (
                                    <Image
                                      src={product.imageUrl}
                                      alt={product.imageAlt}
                                      fill
                                      sizes="4rem"
                                      className={styles.productThumbImage}
                                    />
                                  ) : (
                                    <div className={styles.productThumbPlaceholder}>
                                      <FiImage />
                                    </div>
                                  )}
                                </div>

                                <div className={styles.productInfo}>
                                  <strong>{product.name}</strong>
                                </div>
                              </div>
                            </td>
                            <td className={styles.priceCell}>{product.price}</td>
                            <td>
                              {product.featured ? (
                                <span className={`${styles.statusBadge} ${styles.statusFeatured}`}>
                                  <FiStar />
                                  Featured #{product.featuredPosition ?? "-"}
                                </span>
                              ) : (
                                <span className={`${styles.statusBadge} ${styles.statusMuted}`}>
                                  Not featured
                                </span>
                              )}
                            </td>
                            <td>
                              <form action={updateCookieOfMonthProductAction} className={styles.tickboxForm}>
                                <input type="hidden" name="returnView" value={view} />
                                <input type="hidden" name="productSlug" value={product.slug} />
                                <input
                                  type="hidden"
                                  name="cookieOfMonthSelected"
                                  value={cookieOfMonthSetting.productSlug === product.slug ? "0" : "1"}
                                />
                                <button
                                  type="submit"
                                  className={`${styles.tickboxButton} ${
                                    cookieOfMonthSetting.productSlug === product.slug
                                      ? styles.tickboxButtonActive
                                      : ""
                                  }`.trim()}
                                  aria-pressed={cookieOfMonthSetting.productSlug === product.slug}
                                >
                                  {cookieOfMonthSetting.productSlug === product.slug ? (
                                    <FiCheckCircle />
                                  ) : (
                                    <FiPlus />
                                  )}
                                  <span>
                                    {cookieOfMonthSetting.productSlug === product.slug ? "Selected" : "Set"}
                                  </span>
                                </button>
                              </form>
                            </td>
                            <td>{formatAdminDate(product.createdAt)}</td>
                            <td>{formatAdminDate(product.updatedAt)}</td>
                            <td className={styles.actionsColumn}>
                              <div className={styles.rowActions}>
                                {showingFeaturedOnly && product.featured ? (
                                  <div className={styles.reorderControls}>
                                    <form action={moveFeaturedProductAction}>
                                      <input type="hidden" name="productSlug" value={product.slug} />
                                      <input type="hidden" name="direction" value="up" />
                                      <button
                                        type="submit"
                                        className={styles.reorderButton}
                                        disabled={isFirstFeatured}
                                        aria-label={`Move ${product.name} up`}
                                      >
                                        <FiChevronUp />
                                      </button>
                                    </form>
                                    <form action={moveFeaturedProductAction}>
                                      <input type="hidden" name="productSlug" value={product.slug} />
                                      <input type="hidden" name="direction" value="down" />
                                      <button
                                        type="submit"
                                        className={styles.reorderButton}
                                        disabled={isLastFeatured}
                                        aria-label={`Move ${product.name} down`}
                                      >
                                        <FiChevronDown />
                                      </button>
                                    </form>
                                  </div>
                                ) : null}

                                <Link
                                  href={getAdminHref({ view, productSlug: product.slug })}
                                  className={`${styles.editButton} ${
                                    isActive ? styles.editButtonActive : ""
                                  }`.trim()}
                                >
                                  <span>{isActive ? "Editing" : "Edit"}</span>
                                  <FiChevronRight />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {d1Configured && isEditorOpen ? (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="admin-editor-title">
              <div className={styles.modalHeader}>
                <div>
                  <p className={styles.modalEyebrow}>{createNew ? "New product" : "Edit product"}</p>
                  <h2 id="admin-editor-title">
                    {createNew ? "Add product" : selectedProduct?.name ?? "Edit product"}
                  </h2>
                  <p>
                    {createNew
                      ? "Create a new product and upload its image from this pop-out window."
                      : "Update the selected product without leaving the products table."}
                  </p>
                </div>

                <Link href={getAdminHref({ view })} className={styles.closeButton} aria-label="Close editor">
                  <FiX />
                </Link>
              </div>

              <div className={styles.modalBody}>
                <AdminProductForm
                  variant="modal"
                  mode={createNew || !selectedProduct ? "create" : "edit"}
                  product={selectedProduct}
                  defaultSortOrder={nextSortOrder}
                  defaultFeaturedPosition={nextFeaturedPosition}
                  uploadEnabled={uploadEnabled}
                  returnView={view}
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
