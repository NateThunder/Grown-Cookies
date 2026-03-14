"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  createAdminProduct,
  moveFeaturedProductPosition,
  updateAdminProduct,
} from "@/lib/product-admin";
import {
  ADMIN_AUTH_COOKIE,
  getAdminAuthCookieOptions,
  getSupabaseUserFromAccessToken,
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

function getImageFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function redirectToAdmin({
  productSlug,
  createNew,
  notice,
  warning,
  error,
  returnView,
}: {
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

  redirect(`/admin${searchParams.size ? `?${searchParams.toString()}` : ""}`);
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
}

export async function adminLoginAction(formData: FormData) {
  const email = getTextField(formData, "email").trim();
  const password = getTextField(formData, "password");

  if (!email || !password) {
    redirectToAdmin({
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
      error: result.errorMessage,
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
    notice: "Signed in.",
  });
}

export async function adminLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_AUTH_COOKIE);

  redirectToAdmin({
    notice: "Signed out.",
  });
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