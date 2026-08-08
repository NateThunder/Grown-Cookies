import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import { buildDeliveryPolicySection } from "@/lib/delivery-policy";
import { getCollectionSettings, getDeliveryCostSetting, getDispatchSettings } from "@/lib/store-settings";
import styles from "../terms/page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delivery & Collection",
  description:
    "Delivery and free collection information for Grown Cookies orders.",
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
      <SiteHeader variant="hero" />

      <section className={styles.termsSection}>
        <div className={styles.contentWrap}>
          <h1>Delivery &amp; Collection</h1>

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
            <h2>Free collection</h2>
            <p>Choose Collection in your basket or at checkout, then select an available date.</p>
            <p>
              Collect from {collectionSettings.venue}, {collectionSettings.addressLine1}, {collectionSettings.city}, {collectionSettings.postcode}.
            </p>
            <p>Your order will be ready between {collectionSettings.windowStart} and {collectionSettings.windowEnd} on your selected date.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
