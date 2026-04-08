import {
  COOKIE_CONSENT_STORAGE_KEY,
  isCookieConsentStatus,
  type CookieConsentStatus,
} from "@/lib/cookie-consent";

declare global {
  interface Window {
    __gcUpdateAnalyticsConsent?: (granted: boolean) => void;
  }
}

export function readStoredCookieConsent() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  return isCookieConsentStatus(storedValue) ? storedValue : null;
}

function getCookieDomains() {
  if (typeof window === "undefined") {
    return [];
  }

  const host = window.location.hostname;
  const domains = new Set([host, `.${host}`]);

  if (host.startsWith("www.")) {
    const rootDomain = host.slice(4);
    domains.add(rootDomain);
    domains.add(`.${rootDomain}`);
  }

  return [...domains];
}

function deleteCookie(name: string, domain?: string) {
  const domainFragment = domain ? `; domain=${domain}` : "";
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainFragment}; SameSite=Lax`;
}

function clearAnalyticsCookies() {
  if (typeof document === "undefined") {
    return;
  }

  const cookieNames = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter((name) => name === "_ga" || name === "_gid" || name === "_gat" || name.startsWith("_ga_"));

  const domains = getCookieDomains();

  for (const cookieName of cookieNames) {
    deleteCookie(cookieName);

    for (const domain of domains) {
      deleteCookie(cookieName, domain);
    }
  }
}

export function syncAnalyticsConsent(nextConsent: CookieConsentStatus | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (nextConsent === "accepted") {
    window.__gcUpdateAnalyticsConsent?.(true);
    return;
  }

  window.__gcUpdateAnalyticsConsent?.(false);
  clearAnalyticsCookies();
}

export function writeStoredCookieConsent(nextConsent: CookieConsentStatus) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, nextConsent);
  } catch {
    return false;
  }

  syncAnalyticsConsent(nextConsent);
  return true;
}
