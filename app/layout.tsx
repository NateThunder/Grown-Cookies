import type { Metadata } from "next";
import { Abril_Fatface, Anonymous_Pro, Besley, Fraunces } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { FaTiktok } from "react-icons/fa6";
import { FiInstagram } from "react-icons/fi";
import CookieConsentBanner from "@/components/cookie-consent-banner";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";
import "./globals.css";

const besley = Besley({
  variable: "--font-besley",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "700"],
});

const anonymousPro = Anonymous_Pro({
  variable: "--font-anonymous-pro",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const abrilFatface = Abril_Fatface({
  variable: "--font-abril-fatface",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Grown Cookies",
  description: "Artisan cookies for grown folks.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

function getConsentModeBootstrapScript(measurementId: string) {
  const serializedMeasurementId = JSON.stringify(measurementId);
  const serializedStorageKey = JSON.stringify(COOKIE_CONSENT_STORAGE_KEY);

  return `
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.__gcGoogleAnalyticsMeasurementId = ${serializedMeasurementId};
    window.__gcCookieConsentStorageKey = ${serializedStorageKey};
    window.__gcGoogleAnalyticsLoaded = false;
    window.__gcGoogleAnalyticsConfigured = false;
    window.__gcGetConsentModeSettings = function(granted) {
      return {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: granted ? 'granted' : 'denied'
      };
    };
    window.__gcLoadGoogleAnalytics = function() {
      if (!window.__gcGoogleAnalyticsMeasurementId) {
        return;
      }

      if (document.querySelector('script[data-gc-google-analytics="true"]')) {
        window.__gcGoogleAnalyticsLoaded = true;
      }

      if (!window.__gcGoogleAnalyticsLoaded) {
        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(window.__gcGoogleAnalyticsMeasurementId);
        script.setAttribute('data-gc-google-analytics', 'true');
        script.onerror = function() {
          window.__gcGoogleAnalyticsLoaded = false;
        };
        document.head.appendChild(script);
        window.__gcGoogleAnalyticsLoaded = true;
      }

      if (!window.__gcGoogleAnalyticsConfigured) {
        window.__gcGoogleAnalyticsConfigured = true;
        window.gtag('js', new Date());
        window.gtag('config', window.__gcGoogleAnalyticsMeasurementId);
      }
    };
    window.__gcUpdateAnalyticsConsent = function(granted) {
      window.gtag('consent', 'update', window.__gcGetConsentModeSettings(Boolean(granted)));

      if (granted) {
        window.__gcLoadGoogleAnalytics();
      }
    };
    window.gtag('consent', 'default', window.__gcGetConsentModeSettings(false));

    try {
      var storedConsent = window.localStorage.getItem(window.__gcCookieConsentStorageKey);

      if (storedConsent === 'accepted') {
        window.__gcUpdateAnalyticsConsent(true);
      }
    } catch (error) {}
  `;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {googleAnalyticsId ? (
          <Script id="google-consent-mode" strategy="beforeInteractive">
            {getConsentModeBootstrapScript(googleAnalyticsId)}
          </Script>
        ) : null}
      </head>
      <body
        className={`${besley.variable} ${fraunces.variable} ${anonymousPro.variable} ${abrilFatface.variable} antialiased`}
      >
        {children}
        {googleAnalyticsId ? <CookieConsentBanner /> : null}
        <footer className="site-footer">
          <div className="site-footer-main">
            <div className="site-footer-upper">
              <div className="site-footer-copy">
                <h2>Join our cookie community</h2>
                <p>Subscribe now for exclusive offers and mouthwatering recipes!</p>
              </div>

              <form className="site-footer-form" aria-label="Newsletter signup">
                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="footer-email"
                  type="email"
                  placeholder="Email address"
                  className="site-footer-input"
                />
                <button type="submit" className="site-footer-button">
                  Sign up
                </button>
              </form>
            </div>

            <div className="site-footer-bottom-row">
              <p>
                {"\u00A9"} 2026 <span className="site-footer-brand">Grown Cookies</span>, Created by{" "}
                <a href="https://nathansomevi.dev" target="_blank" rel="noreferrer">
                  Somevi Labs
                </a>
              </p>
              <Link href="/privacy">Privacy Policy</Link>
              <div className="site-footer-social">
                <Link href="#" aria-label="Instagram">
                  <FiInstagram />
                </Link>
                <Link href="#" aria-label="TikTok">
                  <FaTiktok />
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}



