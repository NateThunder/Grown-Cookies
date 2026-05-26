import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import { buildDeliveryPolicySection } from "@/lib/delivery-policy";
import { getDeliveryCostSetting, getDispatchSettings } from "@/lib/store-settings";
import styles from "../terms/page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delivery",
  description:
    "Delivery information for Grown Cookies orders, including dispatch days, Royal Mail tracked service, and delivery timings.",
  alternates: {
    canonical: "/delivery",
  },
};

export default async function DeliveryPage() {
  const [deliveryCostSetting, dispatchSettings] = await Promise.all([
    getDeliveryCostSetting(),
    getDispatchSettings(),
  ]);
  const deliverySections = [
    buildDeliveryPolicySection({
      deliveryCostCents: deliveryCostSetting.deliveryCostCents,
      dispatchSettings,
    }),
  ];

  return (
    <main className={styles.page}>
      <SiteHeader variant="hero" showAnnouncement={false} />

      <section className={styles.termsSection}>
        <div className={styles.contentWrap}>
          <h1>Delivery</h1>

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
        </div>
      </section>
    </main>
  );
}
