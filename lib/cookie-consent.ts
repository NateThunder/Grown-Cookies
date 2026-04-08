export const COOKIE_CONSENT_STORAGE_KEY = "grown-cookies-cookie-consent";

export type CookieConsentStatus = "accepted" | "rejected";

export function isCookieConsentStatus(value: unknown): value is CookieConsentStatus {
  return value === "accepted" || value === "rejected";
}
