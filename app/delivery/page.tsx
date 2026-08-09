import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/json-ld";
import SiteHeader from "@/components/site-header";
import { buildDeliveryPolicySection } from "@/lib/delivery-policy";
import { getCollectionSettings, getDeliveryCostSetting, getDispatchSettings } from "@/lib/store-settings";
import styles from "../terms/page.module.css";
import { getBreadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "UK Cookie Delivery & Glasgow Collection | Grown Cookies" },
  description:
    "Royal Mail Tracked 24 delivery across the UK and free pre-ordered Grown Cookies collection from Duke Street, Glasgow.",
  alternates: {
    canonical: "/delivery",
  },
};

export default async function DeliveryPage() {
  const [deliveryCostSetting, dispatchSettings, collectionSettings] = await Promise.all([
    getDeliveryCostSetting(),
    getDispatchSettings(),
    getCollectionSettings(),
  ]);
  const deliverySections = [
    buildDeliveryPolicySection({
      deliveryCostCents: deliveryCostSetting.deliveryCostCents,
      dispatchSettings,
    }),
  ];

  return (
    <main className={styles.page}>
      <JsonLd data={getBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Delivery and Collection", path: "/delivery" },
      ])} />
      <SiteHeader variant="hero" />

      <section className={styles.termsSection}>
        <div className={styles.contentWrap}>
          <h1>UK Cookie Delivery &amp; Glasgow Collection</h1>

          {deliverySections.map((section) => (
            <article key={section.title} className={`${styles.termsItem} whiteFrame`}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <ul className={styles.cookieBulletList}>
                {section.bulletPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {section.closingParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
          <article className={`${styles.termsItem} whiteFrame`}>
            <h2>Free pre-ordered Glasgow collection</h2>
            <p>Grown Cookies are made to order. Choose Collection in your basket or at checkout, then select an available date before travelling.</p>
            <p>
              Collect from {collectionSettings.venue}, {collectionSettings.addressLine1}, {collectionSettings.city}, {collectionSettings.postcode}.
            </p>
            <p>Your order will be ready between {collectionSettings.windowStart} and {collectionSettings.windowEnd} on your selected date.</p>
            <p><Link href="/cookies-glasgow">Read the complete Glasgow collection guide.</Link></p>
          </article>
          <article className={`${styles.termsItem} whiteFrame`}>
            <h2>Sending cookies as a gift</h2>
            <p>Every physical cookie box can be sent to a UK recipient with an optional personalised notecard. Select the gifting option on the product page before adding the box to your basket.</p>
            <p><Link href="/cookie-gift-boxes">Explore cookie gift boxes.</Link></p>
          </article>
        </div>
      </section>
    </main>
  );
}
