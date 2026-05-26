const DEFAULT_SITE_URL = "https://growncookies.co.uk";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function buildSiteUrl(pathname: string) {
  return new URL(pathname, `${getSiteUrl()}/`).toString();
}
