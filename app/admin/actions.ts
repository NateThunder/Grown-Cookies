"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { buildAdminPath } from "./admin-ui";
import {
  createAdminProduct,
  deleteAdminProduct,
  moveFeaturedProductPosition,
  moveProductSortOrder,
  setAdminProductHidden,
  updateAdminProduct,
} from "@/lib/product-admin";
import {
  PRODUCT_IMAGE_VARIANT_FIELD_NAMES,
  PRODUCT_IMAGE_VARIANT_KEYS,
  type ProductImageCropState,
  type ProductImageVariantMap,
} from "@/lib/product-image-variants";
import { markAdminOrderDelivered } from "@/lib/admin-orders";
import { deleteMailingListSubscriber } from "@/lib/mailing-list";
import {
  getCookieOfMonthSectionSetting,
  updateBrandStorySectionSetting,
  updateCookieOfMonthProductSlug,
  updateCookieOfMonthSectionSetting,
  updateDeliveryCostCents,
  updateSiteLockEnabled,
  updateShopIntroSectionSetting,
} from "@/lib/store-settings";
import { authenticateAdminCredentials } from "@/lib/admin-signin";
import {
  ADMIN_AUTH_COOKIE,
  getAdminAuthCookieOptions,
  getAdminUserFromAccessToken,
} from "@/lib/supabase/admin-auth";

function getTextField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function getNumberField(formData: FormData, key: string) {
  const rawValue = getTextField(formData, key).trim();
  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getMoneyFieldInCents(formData: FormData, key: string) {
  const rawValue = getTextField(formData, key).trim();

  if (!rawValue) {
    throw new Error("Enter a delivery cost.");
  }

  if (rawValue.includes("-")) {
    throw new Error("Delivery cost must be zero or greater.");
  }

  const normalized = rawValue.replace(/[^0-9.]/g, "");

  if (!normalized) {
    throw new Error("Enter a valid delivery cost.");
  }

  const parts = normalized.split(".");

  if (parts.length > 2) {
    throw new Error("Enter a valid delivery cost.");
  }

  const whole = Number.parseInt(parts[0] || "0", 10);

  if (!Number.isFinite(whole)) {
    throw new Error("Enter a valid delivery cost.");
  }

  const decimals = (parts[1] ?? "").padEnd(2, "0").slice(0, 2);
  const minorUnits = Number.parseInt(decimals || "0", 10);

  return whole * 100 + minorUnits;
}

function getImageFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function getImageVariantFiles(formData: FormData) {
  const imageVariantFiles: ProductImageVariantMap<File | null> = {};

  for (const variant of PRODUCT_IMAGE_VARIANT_KEYS) {
    imageVariantFiles[variant] = getImageFile(formData, PRODUCT_IMAGE_VARIANT_FIELD_NAMES[variant]);
  }

  return imageVariantFiles;
}

function getImageVariantCropStates(formData: FormData) {
  const rawValue = getTextField(formData, "imageVariantCropStates").trim();
  const imageVariantCropStates: ProductImageVariantMap<ProductImageCropState> = {};

  if (!rawValue) {
    return imageVariantCropStates;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return imageVariantCropStates;
  }

  if (!parsedValue || typeof parsedValue !== "object") {
    return imageVariantCropStates;
  }

  for (const variant of PRODUCT_IMAGE_VARIANT_KEYS) {
    const cropState = (parsedValue as Record<string, unknown>)[variant];

    if (!cropState || typeof cropState !== "object") {
      continue;
    }

    const panX = Number((cropState as Record<string, unknown>).panX);
    const panY = Number((cropState as Record<string, unknown>).panY);
    const zoom = Number((cropState as Record<string, unknown>).zoom);

    if (!Number.isFinite(panX) || !Number.isFinite(panY) || !Number.isFinite(zoom)) {
      continue;
    }

    imageVariantCropStates[variant] = { panX, panY, zoom };
  }

  return imageVariantCropStates;
}

function getAdminReturnPath(value?: string) {
  return value && value.startsWith("/admin") ? value : "/admin";
}

function redirectToAdmin({
  returnPath,
  productSlug,
  createNew,
  notice,
  warning,
  error,
  returnView,
}: {
  returnPath?: string;
  productSlug?: string;
  createNew?: boolean;
  notice?: string;
  warning?: string;
  error?: string;
  returnView?: string;
}) {
  const adminPath = getAdminReturnPath(returnPath);
  redirect(
    buildAdminPath(adminPath, {
      view: returnView === "featured" ? "featured" : undefined,
      productSlug,
      createNew,
      notice,
      warning,
      error,
    }),
  );
}

async function requireAdminSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;

  if (!accessToken) {
    throw new Error("Please sign in to continue.");
  }

  const user = await getAdminUserFromAccessToken(accessToken);

  if (!user) {
    cookieStore.delete(ADMIN_AUTH_COOKIE);
    throw new Error("Your admin session expired. Sign in again.");
  }
}

function revalidateSiteLockViews() {
  revalidateTag("store-settings-site-lock", "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/homepage");
  revalidatePath("/admin/launch");
}

async function setSiteLockEnabledForAdmin(enabled: boolean) {
  await requireAdminSession();
  await updateSiteLockEnabled(enabled);
  revalidateSiteLockViews();

  return {
    ok: true as const,
    enabled,
  };
}

export async function adminLoginAction(formData: FormData) {
  const email = getTextField(formData, "email").trim();
  const password = getTextField(formData, "password");
  const returnPath = getTextField(formData, "returnPath");
  const result = await authenticateAdminCredentials({
    email,
    password,
  });

  if (!result.ok) {
    redirectToAdmin({
      returnPath,
      error: result.error,
      warning: result.warning,
    });
    return;
  }

  const cookieStore = await cookies();
  const cookieConfig = getAdminAuthCookieOptions();

  cookieStore.set(cookieConfig.name, result.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookieConfig.maxAge,
  });

  redirectToAdmin({
    returnPath,
    notice: "Signed in.",
  });
}

export async function adminLogoutAction(formData: FormData) {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_AUTH_COOKIE);

  redirectToAdmin({
    returnPath: getTextField(formData, "returnPath"),
    notice: "Signed out.",
  });
}

export async function updateDeliveryCostAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    await requireAdminSession();

    await updateDeliveryCostCents(getMoneyFieldInCents(formData, "deliveryCostValue"));
    revalidateTag("store-settings-delivery", "max");
    revalidatePath("/admin");
    revalidatePath("/admin/delivery");
    revalidatePath("/checkout");

    redirectToAdmin({
      returnPath,
      notice: "Delivery cost saved.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      error:
        error instanceof Error
          ? error.message
          : "The delivery cost could not be saved.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function updateCookieOfMonthContentAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    await requireAdminSession();

    await updateCookieOfMonthSectionSetting({
      title: getTextField(formData, "cookieOfMonthTitle"),
      ctaLabel: getTextField(formData, "cookieOfMonthCtaLabel"),
    });

    revalidateTag("products", "max");
    revalidateTag("store-settings-homepage", "max");
    revalidatePath("/");
    revalidatePath("/admin/homepage");

    redirectToAdmin({
      returnPath,
      notice: "Cookie of the Month section saved.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      error:
        error instanceof Error
          ? error.message
          : "The Cookie of the Month section could not be saved.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function updateCookieOfMonthProductAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    await requireAdminSession();

    const productSlug = getTextField(formData, "productSlug").trim();

    if (!productSlug) {
      throw new Error("Choose a product.");
    }

    const isSelected = getTextField(formData, "cookieOfMonthSelected") === "1";

    await updateCookieOfMonthProductSlug(isSelected ? productSlug : undefined);
    revalidateTag("products", "max");
    revalidateTag("store-settings-homepage", "max");
    revalidatePath("/");
    revalidatePath("/admin/homepage");

    redirectToAdmin({
      returnPath,
      notice: isSelected ? "Cookie of the Month updated." : "Cookie of the Month cleared.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      error:
        error instanceof Error
          ? error.message
          : "The Cookie of the Month product could not be saved.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function updateShopIntroContentAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    await requireAdminSession();

    await updateShopIntroSectionSetting({
      eyebrow: getTextField(formData, "shopIntroEyebrow"),
      title: getTextField(formData, "shopIntroTitle"),
      body: getTextField(formData, "shopIntroBody"),
      ctaLabel: getTextField(formData, "shopIntroCtaLabel"),
    });

    revalidateTag("store-settings-homepage", "max");
    revalidatePath("/");
    revalidatePath("/admin/homepage");

    redirectToAdmin({
      returnPath,
      notice: "Shop section saved.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      error: error instanceof Error ? error.message : "The shop section could not be saved.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function updateBrandStoryContentAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    await requireAdminSession();

    await updateBrandStorySectionSetting({
      body: getTextField(formData, "brandStoryBody"),
    });

    revalidateTag("store-settings-homepage", "max");
    revalidatePath("/");
    revalidatePath("/admin/homepage");

    redirectToAdmin({
      returnPath,
      notice: "Brand story section saved.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      error: error instanceof Error ? error.message : "The brand story section could not be saved.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function updateSiteLockAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    const enabled = getTextField(formData, "siteLockEnabled") === "1";

    await setSiteLockEnabledForAdmin(enabled);

    redirectToAdmin({
      returnPath,
      notice: enabled ? "Site lock enabled." : "Site lock disabled.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      error: error instanceof Error ? error.message : "The site lock could not be updated.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function launchSiteAction() {
  try {
    return await setSiteLockEnabledForAdmin(false);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "The site could not be launched.",
    };
  }
}

export async function relockSiteAction() {
  try {
    return await setSiteLockEnabledForAdmin(true);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "The site lock could not be enabled.",
    };
  }
}

export async function createProductAction(formData: FormData) {
  try {
    const returnView = getTextField(formData, "returnView");
    await requireAdminSession();

    const result = await createAdminProduct({
      name: getTextField(formData, "name"),
      priceValue: getTextField(formData, "priceValue"),
      description: getTextField(formData, "description"),
      allergens: getTextField(formData, "allergens"),
      featured: formData.get("featured") === "on",
      featuredPosition: getNumberField(formData, "featuredPosition"),
      sortOrder: getNumberField(formData, "sortOrder"),
      imageFile: getImageFile(formData, "image"),
      imageVariantFiles: getImageVariantFiles(formData),
      imageVariantCropStates: getImageVariantCropStates(formData),
      isGiftCard: formData.get("isGiftCard") === "on",
      hidden: formData.get("hidden") === "on",
    });

    redirectToAdmin({
      productSlug: result.slug,
      notice: "Product created.",
      warning: result.imageWarning,
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirectToAdmin({
      createNew: true,
      error:
        error instanceof Error
          ? error.message
          : "The product could not be created.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function updateProductAction(formData: FormData) {
  try {
    const productId = Number.parseInt(getTextField(formData, "productId"), 10);

    if (!Number.isFinite(productId)) {
      throw new Error("The product record could not be found.");
    }

    const returnView = getTextField(formData, "returnView");
    await requireAdminSession();

    const result = await updateAdminProduct({
      productId,
      name: getTextField(formData, "name"),
      priceValue: getTextField(formData, "priceValue"),
      description: getTextField(formData, "description"),
      allergens: getTextField(formData, "allergens"),
      featured: formData.get("featured") === "on",
      featuredPosition: getNumberField(formData, "featuredPosition"),
      sortOrder: getNumberField(formData, "sortOrder"),
      imageFile: getImageFile(formData, "image"),
      imageVariantFiles: getImageVariantFiles(formData),
      imageVariantCropStates: getImageVariantCropStates(formData),
      isGiftCard: formData.get("isGiftCard") === "on",
      hidden: formData.get("hidden") === "on",
    });

    redirectToAdmin({
      productSlug: result.slug,
      notice: "Product saved.",
      warning: result.imageWarning,
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const productSlug = getTextField(formData, "productSlug") || undefined;

    redirectToAdmin({
      productSlug,
      error:
        error instanceof Error
          ? error.message
          : "The product could not be updated.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function moveFeaturedProductAction(formData: FormData) {
  try {
    await requireAdminSession();

    const productSlug = getTextField(formData, "productSlug").trim();
    const directionValue = getTextField(formData, "direction").trim();
    const direction = directionValue === "up" || directionValue === "down" ? directionValue : null;

    if (!productSlug || !direction) {
      throw new Error("Could not move featured product.");
    }

    await moveFeaturedProductPosition(productSlug, direction);

    redirectToAdmin({
      returnView: "featured",
      notice: "Featured product order updated.",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirectToAdmin({
      returnView: "featured",
      error:
        error instanceof Error
          ? error.message
          : "The featured product could not be moved.",
    });
  }
}

export async function moveProductSortOrderAction(formData: FormData) {
  try {
    await requireAdminSession();

    const productId = Number.parseInt(getTextField(formData, "productId"), 10);
    const directionValue = getTextField(formData, "direction").trim();
    const direction = directionValue === "up" || directionValue === "down" ? directionValue : null;

    if (!Number.isFinite(productId) || !direction) {
      throw new Error("Could not move product.");
    }

    await moveProductSortOrder(productId, direction);

    redirectToAdmin({
      returnView: "all",
      notice: "Product order updated.",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirectToAdmin({
      returnView: "all",
      error: error instanceof Error ? error.message : "The product could not be moved.",
    });
  }
}

export async function deleteProductAction(formData: FormData) {
  try {
    const productId = Number.parseInt(getTextField(formData, "productId"), 10);

    if (!Number.isFinite(productId)) {
      throw new Error("The product record could not be found.");
    }

    const returnView = getTextField(formData, "returnView");
    await requireAdminSession();

    const productSlug = getTextField(formData, "productSlug").trim();
    const cookieOfMonthSetting = await getCookieOfMonthSectionSetting();

    const result = await deleteAdminProduct(productId);

    if (productSlug && cookieOfMonthSetting.productSlug === productSlug) {
      await updateCookieOfMonthProductSlug(undefined);
      revalidateTag("store-settings-homepage", "max");
      revalidatePath("/");
      revalidatePath("/admin/homepage");
    }

    redirectToAdmin({
      notice: "Product deleted.",
      warning: result.imageWarning,
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const productSlug = getTextField(formData, "productSlug") || undefined;

    redirectToAdmin({
      productSlug,
      error:
        error instanceof Error
          ? error.message
          : "The product could not be deleted.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function deleteMailingListSubscriberAction(formData: FormData) {
  const returnPath = getTextField(formData, "returnPath") || "/admin/mailing-list";

  try {
    const subscriberId = Number.parseInt(getTextField(formData, "subscriberId"), 10);

    if (!Number.isFinite(subscriberId)) {
      throw new Error("The subscriber record could not be found.");
    }

    await requireAdminSession();
    await deleteMailingListSubscriber(subscriberId);
    revalidatePath("/admin/mailing-list");

    redirectToAdmin({
      returnPath,
      notice: "Subscriber deleted.",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath,
      error:
        error instanceof Error
          ? error.message
          : "The subscriber could not be deleted.",
    });
  }
}

export async function toggleProductHiddenAction(formData: FormData) {
  try {
    const productId = Number.parseInt(getTextField(formData, "productId"), 10);

    if (!Number.isFinite(productId)) {
      throw new Error("The product record could not be found.");
    }

    const returnView = getTextField(formData, "returnView");
    await requireAdminSession();

    const productSlug = getTextField(formData, "productSlug").trim();
    const hidden = getTextField(formData, "hidden") === "1";
    const cookieOfMonthSetting = await getCookieOfMonthSectionSetting();

    await setAdminProductHidden(productId, hidden);

    if (hidden && productSlug && cookieOfMonthSetting.productSlug === productSlug) {
      await updateCookieOfMonthProductSlug(undefined);
      revalidateTag("store-settings-homepage", "max");
      revalidatePath("/");
      revalidatePath("/admin/homepage");
    }

    redirectToAdmin({
      notice: hidden ? "Product hidden." : "Product shown.",
      returnView,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const productSlug = getTextField(formData, "productSlug") || undefined;

    redirectToAdmin({
      productSlug,
      error:
        error instanceof Error
          ? error.message
          : "The product visibility could not be updated.",
      returnView: getTextField(formData, "returnView"),
    });
  }
}

export async function markOrderDeliveredAction(formData: FormData) {
  try {
    await requireAdminSession();

    const returnView = getTextField(formData, "returnView");
    const returnPath = getTextField(formData, "returnPath");
    const orderId = getTextField(formData, "orderId");
    const result = await markAdminOrderDelivered(orderId);

    revalidatePath("/admin");
    revalidatePath("/account");

    redirectToAdmin({
      returnPath,
      returnView,
      notice: result.alreadyDelivered ? "Order already marked as delivered." : "Order marked as delivered.",
      warning: result.emailWarning || undefined,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdmin({
      returnPath: getTextField(formData, "returnPath"),
      returnView: getTextField(formData, "returnView"),
      error: error instanceof Error ? error.message : "The order could not be updated.",
    });
  }
}
