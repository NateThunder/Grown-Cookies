"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  createAdminProduct,
  moveFeaturedProductPosition,
  updateAdminProduct,
} from "@/lib/product-admin";
import {
  updateBrandStorySectionSetting,
  updateCookieOfMonthProductSlug,
  updateCookieOfMonthSectionSetting,
  updateDeliveryCostCents,
  updateShopIntroSectionSetting,
} from "@/lib/store-settings";
import {
  ADMIN_AUTH_COOKIE,
  getAdminAccessDeniedMessage,
  getAdminAuthCookieOptions,
  getSupabaseUserFromAccessToken,
  isAdminUser,
  signInToSupabaseWithPassword,
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
  const searchParams = new URLSearchParams();

  if (returnView === "featured") {
    searchParams.set("view", "featured");
  }

  if (productSlug) {
    searchParams.set("product", productSlug);
  }

  if (createNew) {
    searchParams.set("new", "1");
  }

  if (notice) {
    searchParams.set("notice", notice);
  }

  if (warning) {
    searchParams.set("warning", warning);
  }

  if (error) {
    searchParams.set("error", error);
  }

  const adminPath = getAdminReturnPath(returnPath);

  redirect(`${adminPath}${searchParams.size ? `?${searchParams.toString()}` : ""}`);
}

async function requireAdminSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;

  if (!accessToken) {
    throw new Error("Please sign in to continue.");
  }

  const user = await getSupabaseUserFromAccessToken(accessToken);

  if (!user) {
    throw new Error("Your admin session expired. Sign in again.");
  }

  if (!isAdminUser(user)) {
    cookieStore.delete(ADMIN_AUTH_COOKIE);
    throw new Error(getAdminAccessDeniedMessage());
  }
}

export async function adminLoginAction(formData: FormData) {
  const email = getTextField(formData, "email").trim();
  const password = getTextField(formData, "password");
  const returnPath = getTextField(formData, "returnPath");

  if (!email || !password) {
    redirectToAdmin({
      returnPath,
      error: "Enter both email and password.",
    });
    return;
  }

  const result = await signInToSupabaseWithPassword({
    email,
    password,
  });

  if ("errorMessage" in result) {
    redirectToAdmin({
      returnPath,
      error: result.errorMessage,
    });
    return;
  }

  const user = await getSupabaseUserFromAccessToken(result.accessToken);

  if (!isAdminUser(user)) {
    redirectToAdmin({
      returnPath,
      error: getAdminAccessDeniedMessage(),
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
      isGiftCard: formData.get("isGiftCard") === "on",
    });

    revalidateTag("products", "max");

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
      isGiftCard: formData.get("isGiftCard") === "on",
    });

    revalidateTag("products", "max");

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
    revalidateTag("products", "max");

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
