const LOCAL_IMAGE_FALLBACKS: Record<string, string> = {
  "gift-card/growncookies-1024-transparent.png":
    "/growncookies-1024-transparent.png",
};

export function buildProductImageUrl(imageKey?: string | null) {
  if (!imageKey) {
    return undefined;
  }

  if (/^https?:\/\//.test(imageKey)) {
    return imageKey;
  }

  const normalizedImageKey = imageKey.replace(/^\/+/, "");
  const r2PublicBaseUrl =
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";

  if (r2PublicBaseUrl) {
    return `${r2PublicBaseUrl}/${normalizedImageKey}`;
  }

  return LOCAL_IMAGE_FALLBACKS[normalizedImageKey] ?? `/${normalizedImageKey}`;
}