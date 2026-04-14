"use client";

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
import styles from "./privacy-cookie-preferences.module.css";

function getStatusCopy(consent: CookieConsentStatus | null) {
  if (consent === "accepted") {
    return "Optional analytics are allowed on this browser.";
  }

  if (consent === "rejected") {
    return "Only necessary storage is allowed on this browser.";
  }

  return "No saved preference yet. Optional analytics stay off until you allow them.";
}

export default function PrivacyCookiePreferences() {
  const [consent, setConsent] = useState<CookieConsentStatus | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setConsent(readStoredCookieConsent());
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

  function updateConsent(nextConsent: CookieConsentStatus) {
    if (!writeStoredCookieConsent(nextConsent)) {
      return;
    }

    setConsent(nextConsent);
  }

  return (
    <div className={`${styles.panel} whiteFrame`}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Cookie preferences</p>
        <p className={styles.description}>
          Essential storage always stays on. Use these controls to allow or block optional
          analytics cookies on this browser.
        </p>
      </div>

      <p className={styles.status} aria-live="polite">
        Current setting:{" "}
        <strong>{isReady ? getStatusCopy(consent) : "Loading your saved preference..."}</strong>
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={consent === "rejected"}
          onClick={() => updateConsent("rejected")}
        >
          Necessary only
        </button>
        <button
          type="button"
          className={styles.button}
          aria-pressed={consent === "accepted"}
          onClick={() => updateConsent("accepted")}
        >
          Allow analytics
        </button>
      </div>
    </div>
  );
}
