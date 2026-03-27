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
import AdminProductForm from "@/components/admin-product-form";
import {
  adminLoginAction,
  adminLogoutAction,
  moveFeaturedProductAction,
  updateDeliveryCostAction,
} from "./actions";
import { hasCloudflareD1Config } from "@/lib/cloudflare-d1";
import { hasCloudflareR2UploadConfig } from "@/lib/cloudflare-r2";
import { getAdminProducts, getNextFeaturedPosition, getNextProductSortOrder } from "@/lib/product-admin";
import { DEFAULT_DELIVERY_COST_CENTS, getDeliveryCostSetting } from "@/lib/store-settings";
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

function formatAdminCurrency(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

function AdminLoginScreen({
  error,
  supabaseConfigured,
}: {
  error?: string;
  supabaseConfigured: boolean;
}) {
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <p className={styles.loginEyebrow}>Admin access</p>
        <h1>Sign in to manage products</h1>
        <p className={styles.loginCopy}>
          Use your Supabase account to access the Grown Cookies product studio.
        </p>

        {!supabaseConfigured ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <FiAlertCircle />
            <span>
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </span>
          </div>
        ) : null}

        {error ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        ) : null}

        <form action={adminLoginAction} className={styles.loginForm}>
          <label className={styles.loginField}>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label className={styles.loginField}>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={!supabaseConfigured}
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
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
        error={error}
        supabaseConfigured={supabaseConfigured}
      />
    );
  }

  const d1Configured = hasCloudflareD1Config();
  const uploadEnabled = hasCloudflareR2UploadConfig();
  const products = d1Configured ? await getAdminProducts() : [];
  const nextSortOrder = d1Configured ? await getNextProductSortOrder() : 1;
  const nextFeaturedPosition = d1Configured ? await getNextFeaturedPosition() : 1;
  const deliveryCostSetting = d1Configured
    ? await getDeliveryCostSetting()
    : {
        deliveryCostCents: DEFAULT_DELIVERY_COST_CENTS,
        isDefault: true,
        updatedAt: undefined,
      };
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

        <div className={styles.navSection}>
          <p className={styles.navLabel}>Products</p>
          <div className={styles.navList}>
            <Link
              href={getAdminHref({ view: "all" })}
              className={`${styles.navItem} ${!showingFeaturedOnly ? styles.navItemActive : ""}`.trim()}
            >
              Edit products
            </Link>
          </div>
          <p className={styles.navHint}>Add, update, and manage your full product catalogue.</p>
        </div>

        <div className={styles.navSection}>
          <p className={styles.navLabel}>Homepage</p>
          <div className={styles.navList}>
            <Link
              href={getAdminHref({ view: "featured" })}
              className={`${styles.navItem} ${showingFeaturedOnly ? styles.navItemActive : ""}`.trim()}
            >
              Edit featured products
            </Link>
          </div>
          <p className={styles.navHint}>Control which products are shown on the homepage.</p>
        </div>



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
              <div className={styles.metricCard}>
                <span>Total products</span>
                <strong>{products.length}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Featured</span>
                <strong>{featuredProducts.length}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Delivery fee</span>
                <strong>{formatAdminCurrency(deliveryCostSetting.deliveryCostCents)}</strong>
              </div>
            </div>

            <div className={styles.headerButtonRow}>
              <Link href={getAdminHref({ view, createNew: true })} className={styles.addButton}>
                <FiPlus />
                <span>Add product</span>
              </Link>

              <form action={adminLogoutAction}>
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
              <section className={styles.settingsPanel}>
                <div className={styles.settingsPanelHeader}>
                  <div>
                    <p className={styles.tableEyebrow}>Checkout</p>
                    <h2>Delivery costs</h2>
                  </div>
                  <p className={styles.tableHint}>
                    Update the flat standard-delivery fee used in checkout and saved into new Stripe
                    orders.
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
                    <input type="hidden" name="returnView" value={view} />

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



