"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { COOKIE_CONSENT_UPDATED_EVENT } from "@/lib/cookie-consent-client";
import {
  clearOrderJourney,
  getCurrentPlatformSource,
  recordOrderJourneyEvent,
} from "@/lib/order-journey-client";

function recordCurrentStep(pathname: string) {
  recordOrderJourneyEvent("source", { label: getCurrentPlatformSource() });

  if (pathname === "/shop") {
    recordOrderJourneyEvent("shop", { label: "Shop" });
  } else if (pathname === "/cart") {
    recordOrderJourneyEvent("basket", { label: "Basket" });
  } else if (pathname === "/checkout") {
    recordOrderJourneyEvent("checkout", { label: "Checkout" });
  }
}

export default function OrderJourneyTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordCurrentStep(pathname);

    function handleConsentUpdated(event: Event) {
      const consent = (event as CustomEvent<{ consent?: string }>).detail?.consent;
      if (consent === "accepted") {
        recordCurrentStep(pathname);
      } else {
        clearOrderJourney();
      }
    }

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdated);
    return () => window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdated);
  }, [pathname]);

  return null;
}
