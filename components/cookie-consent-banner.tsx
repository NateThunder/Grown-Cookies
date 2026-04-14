"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  isCookieConsentStatus,
  type CookieConsentStatus,
} from "@/lib/cookie-consent";
import {
  readStoredCookieConsent,
  syncAnalyticsConsent,
  writeStoredCookieConsent,
} from "@/lib/cookie-consent-client";
import styles from "./cookie-consent-banner.module.css";

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsentStatus | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedConsent = readStoredCookieConsent();
    setConsent(storedConsent);
    setIsReady(true);

    function handleStorage(event: StorageEvent) {
      if (event.key !== COOKIE_CONSENT_STORAGE_KEY) {
        return;
      }

      const nextConsent = isCookieConsentStatus(event.newValue) ? event.newValue : null;
      setConsent(nextConsent);
      syncAnalyticsConsent(nextConsent);
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function applyConsent(nextConsent: CookieConsentStatus) {
    if (!writeStoredCookieConsent(nextConsent)) {
      return;
    }

    setConsent(nextConsent);
  }

  if (!isReady || consent !== null) {
    return null;
  }

  return (
    <div className={styles.root}>
      <section
        className={`${styles.banner} whiteFrame`}
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
      >
        <p className={styles.eyebrow}>Cookie choices</p>
        <h2 id="cookie-consent-title">Choose whether analytics can run.</h2>
        <p id="cookie-consent-description" className={styles.description}>
          We always keep essential storage on for your basket, checkout, and security. Google
          Analytics only loads if you allow optional analytics cookies.
        </p>
        <p className={styles.meta}>
          Read more in our <Link href="/privacy">privacy policy</Link>.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => applyConsent("rejected")}>
            Necessary only
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => applyConsent("accepted")}>
            Allow analytics
          </button>
        </div>
      </section>
    </div>
  );
}
