import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/json-ld";
import SiteHeader from "@/components/site-header";
import { getCollectionSettings, getDispatchSettings } from "@/lib/store-settings";
import { getBreadcrumbJsonLd, getFaqJsonLd } from "@/lib/seo";
import styles from "../faqs/page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Handmade Cookies in Glasgow | Grown Cookies" },
  description:
    "Pre-order handmade Grown Cookies for collection from Akara Bakery on Duke Street, Glasgow, or choose tracked UK delivery.",
  alternates: { canonical: "/cookies-glasgow" },
  openGraph: {
    title: "Handmade Cookies in Glasgow | Grown Cookies",
    description: "Made-to-order cookie boxes available for pre-ordered collection in Glasgow.",
    url: "/cookies-glasgow",
    type: "website",
  },
};

function formatTime(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "pm" : "am";
  const hour = hours % 12 || 12;
  return minutes === 0 ? `${hour}${suffix}` : `${hour}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export default async function CookiesGlasgowPage() {
  const [collection, dispatch] = await Promise.all([
    getCollectionSettings(),
    getDispatchSettings(),
  ]);
  const address = `${collection.venue}, ${collection.addressLine1}, ${collection.city}, ${collection.postcode}`;
  const collectionWindow = `${formatTime(collection.windowStart)}–${formatTime(collection.windowEnd)}`;
  const sameDayCollection = dispatch.sameDayEnabled && dispatch.minimumPrepDays === 0;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const collectionItems = [
    {
      question: "Where can I collect cookies in Glasgow?",
      answer: `Pre-ordered Grown Cookies can be collected from ${address}.`,
    },
    {
      question: "When can I collect my order?",
      answer: `Orders are normally ready between ${collectionWindow} on the date selected at checkout. Your checkout shows the dates currently available.`,
    },
    {
      question: "Can I collect cookies on the same day?",
      answer: sameDayCollection
        ? `Same-day collection may be available when you order before ${formatTime(dispatch.cutoffTime)} on an available collection day. Checkout shows current availability.`
        : "Choose from the available collection dates shown at checkout. All cookie boxes are made to order.",
    },
    {
      question: "Can I walk in and buy cookies?",
      answer: "Grown Cookies are made to order, so please order online and select Collection before travelling.",
    },
    {
      question: "Can you deliver outside Glasgow?",
      answer: "Yes. Eligible products are sent throughout the UK using Royal Mail Tracked 24. Choose an available dispatch date during checkout.",
    },
  ];

  return (
    <main className={styles.page}>
      <JsonLd data={[
        getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Cookies Glasgow", path: "/cookies-glasgow" },
        ]),
        getFaqJsonLd(collectionItems),
      ]} />
      <SiteHeader variant="hero" />

      <section className={styles.faqSection}>
        <div className={styles.contentWrap}>
          <h1>Glasgow Collection</h1>
          <p className={styles.intro}>Order your cookies online, choose Collection, then collect from Akara Bakery on Duke Street.</p>

          {collectionItems.map((item) => (
            <article key={item.question} className={`${styles.faqItem} whiteFrame`}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}

          <article className={`${styles.faqItem} whiteFrame`}>
            <h2>Ready to order?</h2>
            <p><Link href="/shop">Shop cookie boxes</Link> or <a href={mapUrl} target="_blank" rel="noreferrer">view the collection point</a>.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
