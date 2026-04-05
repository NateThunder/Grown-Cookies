import Image from "next/image";
import Link from "next/link";
import {
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiChevronUp,
  FiImage,
  FiPlus,
  FiStar,
  FiX,
} from "react-icons/fi";
import AdminLoginScreen from "@/components/admin-login-screen";
import AdminProductForm from "@/components/admin-product-form";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import { getAdminOrderCount } from "@/lib/admin-orders";
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
  moveFeaturedProductAction,
  toggleProductHiddenAction,
  updateCookieOfMonthProductAction,
} from "./actions";
import { getAdminPageContext } from "./admin-page-context";
import {
  formatAdminCurrency,
  formatAdminDate,
  getAdminHref,
  parseAdminProductPageState,
  type SearchParamValue,
} from "./admin-ui";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const context = await getAdminPageContext(searchParams);
  const { view, showingFeaturedOnly, selectedProductSlug, createNew } = parseAdminProductPageState(
    context.params,
  );

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to manage products"
        returnPath="/admin"
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  const uploadEnabled = hasCloudflareR2UploadConfig();
  let products: Awaited<ReturnType<typeof getAdminProducts>> = [];
  let adminOrderCount = 0;
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

  if (context.d1Configured) {
    [products, adminOrderCount, deliveryCostSetting, cookieOfMonthSetting] = await Promise.all([
      getAdminProducts(),
      getAdminOrderCount(),
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
  const selectedProduct = selectedProductSlug
    ? products.find((product) => product.slug === selectedProductSlug)
    : undefined;
  const isEditorOpen = createNew || Boolean(selectedProduct);

  return (
    <AdminShell
      eyebrow={showingFeaturedOnly ? "Homepage" : "Catalogue"}
      title={showingFeaturedOnly ? "Featured products" : "Products"}
      description={
        showingFeaturedOnly
          ? "Adjust which products appear on the homepage and their display order."
          : "Keep the product list, homepage picks, and product images in sync from one place."
      }
      returnPath="/admin"
      flash={context.flash}
      metrics={
        <>
          <Link href={getAdminHref({ view: "all" })} className={styles.metricCardLink}>
            <span>Total products</span>
            <strong>{products.length}</strong>
          </Link>
          <Link href="/admin/orders" className={styles.metricCardLink}>
            <span>Orders</span>
            <strong>{adminOrderCount}</strong>
          </Link>
          <Link href={getAdminHref({ view: "featured" })} className={styles.metricCardLink}>
            <span>Featured</span>
            <strong>{featuredProducts.length}</strong>
          </Link>
          <Link href="/admin/delivery" className={styles.metricCardLink}>
            <span>Delivery fee</span>
            <strong>{formatAdminCurrency(deliveryCostSetting.deliveryCostCents)}</strong>
          </Link>
        </>
      }
      actions={
        <Link href={getAdminHref({ view, createNew: true })} className={styles.addButton}>
          <FiPlus />
          <span>Add product</span>
        </Link>
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
                      <th scope="col">Visibility</th>
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
                            <span
                              className={`${styles.statusBadge} ${
                                product.hidden ? styles.statusHidden : styles.statusVisible
                              }`}
                            >
                              {product.hidden ? "Hidden" : "Visible"}
                            </span>
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
                                disabled={product.hidden}
                              >
                                {cookieOfMonthSetting.productSlug === product.slug ? (
                                  <FiCheckCircle />
                                ) : (
                                  <FiPlus />
                                )}
                                <span>
                                  {product.hidden
                                    ? "Unavailable"
                                    : cookieOfMonthSetting.productSlug === product.slug
                                      ? "Selected"
                                      : "Set"}
                                </span>
                              </button>
                            </form>
                          </td>
                          <td>{formatAdminDate(product.createdAt)}</td>
                          <td>{formatAdminDate(product.updatedAt)}</td>
                          <td className={styles.actionsColumn}>
                            <div className={styles.rowActions}>
                              <form action={toggleProductHiddenAction}>
                                <input type="hidden" name="productId" value={product.id} />
                                <input type="hidden" name="productSlug" value={product.slug} />
                                <input type="hidden" name="returnView" value={view} />
                                <input type="hidden" name="hidden" value={product.hidden ? "0" : "1"} />
                                <button
                                  type="submit"
                                  className={`${styles.visibilityButton} ${
                                    product.hidden ? styles.showButton : styles.hideButton
                                  }`}
                                >
                                  {product.hidden ? "Show" : "Hide"}
                                </button>
                              </form>

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

      {context.d1Configured && isEditorOpen ? (
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
    </AdminShell>
  );
}
