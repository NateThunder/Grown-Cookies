import { createProductAction, deleteProductAction, updateProductAction } from "@/app/admin/actions";
import { formatAdminDateTime } from "@/app/admin/admin-ui";
import type { AdminProduct } from "@/lib/product-admin";
import AdminDeleteButton from "./admin-delete-button";
import AdminImageInput from "./admin-image-input";
import AdminProductSubmit from "./admin-product-submit";
import styles from "./admin-product-form.module.css";

type AdminProductFormProps = {
  mode: "create" | "edit";
  product?: AdminProduct;
  defaultSortOrder: number;
  defaultFeaturedPosition: number;
  uploadEnabled: boolean;
  variant?: "default" | "drawer" | "modal";
  returnView?: "all" | "featured";
};

export default function AdminProductForm({
  mode,
  product,
  defaultSortOrder,
  defaultFeaturedPosition,
  uploadEnabled,
  variant = "default",
  returnView = "all",
}: AdminProductFormProps) {
  const isCreateMode = mode === "create";
  const isCompact = variant === "drawer";
  const isModal = variant === "modal";
  const formAction = isCreateMode ? createProductAction : updateProductAction;
  const heading = isCreateMode ? "Add product" : product?.name ?? "Edit product";
  const intro = isCreateMode
    ? "Create a new product and upload its main image."
    : "Update the selected product and keep its image and homepage placement in sync.";

  return (
    <div className={styles.formStack}>
      <form
        action={formAction}
        encType="multipart/form-data"
        className={`${styles.form} ${isCompact ? styles.drawerForm : ""} ${
          isModal ? styles.modalForm : ""
        }`.trim()}
      >
        <input type="hidden" name="returnView" value={returnView} />

        {!isCreateMode && product ? (
          <>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="productSlug" value={product.slug} />
          </>
        ) : null}

        <div className={styles.formHeader}>
          <div>
            <p className={styles.eyebrow}>{isCreateMode ? "New product" : "Edit product"}</p>
            <h2>{heading}</h2>
            <p>{intro}</p>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>Added</span>
              <strong>
                {isCreateMode
                  ? "Saved when created"
                  : product?.createdAt
                    ? formatAdminDateTime(product.createdAt)
                    : "Not saved yet"}
              </strong>
            </div>
            <div className={styles.metaItem}>
              <span>Last updated</span>
              <strong>
                {isCreateMode
                  ? "Updated when saved"
                  : product?.updatedAt
                    ? formatAdminDateTime(product.updatedAt)
                    : "Not saved yet"}
              </strong>
            </div>
          </div>
        </div>
        <div className={styles.contentGrid}>
          <AdminImageInput
            productId={product?.id}
            productSlug={product?.slug}
            currentImageUrl={product?.imageUrl}
            currentImageAlt={product?.imageAlt ?? `${product?.name ?? "Product"} image`}
            required={isCreateMode && uploadEnabled}
            disabled={!uploadEnabled}
            canCropCurrentImage={!isCreateMode && Boolean(product?.imageUrl)}
            initialCropStates={product?.imageVariantCropStates}
          />

          <div className={styles.fieldsColumn}>
            <label className={styles.field}>
              <span>Product name</span>
              <input
                type="text"
                name="name"
                defaultValue={product?.name ?? ""}
                placeholder="Dark Choc & Maldon Salt"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Price (£)</span>
              <input
                type="number"
                name="priceValue"
                defaultValue={product?.priceValue ?? ""}
                min="0"
                step="0.01"
                placeholder="23.00"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Description</span>
              <textarea
                name="description"
                rows={isCompact ? 6 : 8}
                defaultValue={product?.description ?? ""}
                placeholder="Describe the flavour, texture, and what makes this cookie special."
                required
              />
            </label>

            <label className={styles.field}>
              <span>SEO description (optional)</span>
              <textarea
                name="seoDescription"
                rows={3}
                maxLength={160}
                defaultValue={product?.seoDescription ?? ""}
                placeholder="Leave blank to generate this automatically."
              />
              <small>
                Used in search results. Leave blank for an automatic description based on the product name and type. Maximum 160 characters.
              </small>
            </label>

            <label className={styles.field}>
              <span>Allergens</span>
              <input
                type="text"
                name="allergens"
                defaultValue={product?.allergens ?? ""}
                placeholder="wheat, milk, eggs, hazelnuts"
              />
            </label>

            <div className={styles.controlRow}>
              <label className={styles.checkboxCard}>
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={product?.featured ?? false}
                />
                <span>
                  <strong>Show on homepage</strong>
                  <small>Featured products appear left to right by homepage position.</small>
                </span>
              </label>

              <label className={styles.checkboxCard}>
                <input
                  type="checkbox"
                  name="isGiftCard"
                  defaultChecked={product?.isGiftCard ?? false}
                />
                <span>
                  <strong>Gift card product</strong>
                  <small>Use the gift card styling already built into the storefront.</small>
                </span>
              </label>

              <label className={styles.checkboxCard}>
                <input
                  type="checkbox"
                  name="hidden"
                  defaultChecked={product?.hidden ?? false}
                />
                <span>
                  <strong>Hide from storefront</strong>
                  <small>Keep it editable in admin while removing it from shop and homepage lists.</small>
                </span>
              </label>
            </div>

            <label className={styles.field}>
              <span>Homepage position</span>
              <input
                type="number"
                name="featuredPosition"
                defaultValue={product?.featuredPosition ?? defaultFeaturedPosition}
                min="1"
                step="1"
              />
            </label>

            <label className={styles.field}>
              <span>Catalogue order</span>
              <input
                type="number"
                name="sortOrder"
                defaultValue={product?.sortOrder ?? defaultSortOrder}
                min="0"
                step="1"
              />
            </label>

            <AdminProductSubmit
              idleLabel={isCreateMode ? "Create product" : "Save changes"}
              pendingLabel={isCreateMode ? "Creating..." : "Saving..."}
              idleNote={
                isCreateMode
                  ? "The product record and primary image are created together."
                  : "Saving updates the product first and replaces the main image when a new file is attached."
              }
              pendingNote={
                isCreateMode
                  ? "Creating the product and uploading its image. Keep this window open."
                  : "Saving the product and uploading any new image. Keep this window open."
              }
            />
          </div>
        </div>
      </form>

      {!isCreateMode && product ? (
        <form action={deleteProductAction} className={styles.deleteForm}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="productSlug" value={product.slug} />
          <input type="hidden" name="returnView" value={returnView} />
          <div className={styles.deleteCard}>
            <div>
              <p className={styles.deleteEyebrow}>Danger zone</p>
              <h3>Delete this product</h3>
              <p>
                This removes the product from the catalogue, featured list, and admin table.
              </p>
            </div>
            <AdminDeleteButton />
          </div>
        </form>
      ) : null}
    </div>
  );
}
