import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminProductById } from "@/lib/product-admin";
import { ADMIN_AUTH_COOKIE, getAdminUserFromAccessToken } from "@/lib/supabase/admin-auth";

async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const adminUser = await getAdminUserFromAccessToken(accessToken);

  return Boolean(adminUser);
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = Number.parseInt(searchParams.get("productId") ?? "", 10);

  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  }

  try {
    const product = await getAdminProductById(productId);

    if (!product?.imageUrl) {
      return NextResponse.json({ error: "Product image not found." }, { status: 404 });
    }

    const imageUrl = new URL(product.imageUrl, request.url);

    if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Product image not found." }, { status: 404 });
    }

    const imageResponse = await fetch(imageUrl, { cache: "no-store" });

    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Product image not found." }, { status: 502 });
    }

    const contentType = imageResponse.headers.get("content-type") ?? "application/octet-stream";

    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Product image not found." }, { status: 502 });
    }

    return new Response(await imageResponse.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The product image could not be loaded.",
      },
      { status: 500 },
    );
  }
}
