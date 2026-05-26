import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import { buildDeliveryPolicySection } from "@/lib/delivery-policy";
import { getDeliveryCostSetting, getDispatchSettings } from "@/lib/store-settings";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Grown Cookies terms of service, product information, allergen notices, orders, payments, delivery, refunds, and returns.",
  alternates: {
    canonical: "/terms",
  },
};

const termsSections = [
  {
    title: "Terms and Conditions",
    paragraphs: [
      "Last updated: May 2026",
      "These Terms and Conditions govern your use of the Grown Cookies website and the purchase of products from us. By placing an order with us, you agree to be bound by these terms.",
    ],
  },
  {
    title: "1. Company Information",
    paragraphs: [
      "Grown Cookies",
      "Office 85",
      "13 Fitzroy Place, 1/1",
      "Sauchiehall Street",
      "G3 7RH",
      "United Kingdom",
      "Email: orders@growncookies.co.uk",
    ],
  },
  {
    title: "2. Products",
    paragraphs: [
      "We sell freshly baked cookies and related baked goods.",
      "All products are handmade in small batches.",
      "Products may vary slightly in appearance due to their handmade nature.",
      "Product images are for illustrative purposes only.",
    ],
  },
  {
    title: "3. Allergens",
    paragraphs: [
      "Our products may contain or come into contact with gluten (wheat), milk and dairy products, eggs, nuts, soy, and other allergens depending on flavour.",
      "While we take care to minimise cross-contamination, we cannot guarantee any product is allergen-free.",
      "It is the customer’s responsibility to check allergen information before ordering.",
    ],
  },
  {
    title: "4. Orders",
    paragraphs: [
      "Orders are placed via our website or approved ordering channels.",
      "Once an order is placed, you will receive an order confirmation email.",
      "We reserve the right to refuse or cancel orders at our discretion.",
      "If an order is cancelled by us, you will receive a full refund.",
    ],
  },
  {
    title: "5. Pricing & Payment",
    paragraphs: [
      "All prices are listed in GBP (£).",
      "Payment must be made in full at the time of ordering.",
      "We reserve the right to change prices at any time, but this will not affect confirmed orders.",
    ],
  },
  {
    title: "6. Delivery",
    paragraphs: [
      "We deliver across the UK using third-party courier services.",
      "Orders cannot be dispatched on bank holidays in England, Wales, or Scotland, and those dates will not be available to select at checkout.",
      "Delivery times are estimates and not guaranteed.",
      "We are not responsible for delays caused by courier services or external factors.",
      "Risk passes to the customer once the order has been dispatched.",
    ],
  },
  {
    title: "7. Freshness & Storage",
    paragraphs: [
      "Our cookies are best consumed within the recommended time stated on packaging.",
      "Customers are responsible for storing products correctly upon delivery.",
      "We are not liable for deterioration due to improper storage after delivery.",
    ],
  },
  {
    title: "8. Refunds & Returns",
    paragraphs: [
      "Due to the perishable nature of our products, we do not accept returns on food items.",
      "Refunds or replacements will only be issued if the product is damaged on arrival or the wrong item was delivered.",
      "To request a refund, you must contact us within 24 hours of delivery at orders@growncookies.co.uk.",
      "Photographic evidence may be required.",
    ],
  },
  {
    title: "9. Cancellations",
    paragraphs: [
      "Orders may only be cancelled before production begins.",
      "Once baking has started, cancellations are not possible due to the made-to-order nature of our products.",
    ],
  },
  {
    title: "10. Liability",
    paragraphs: [
      "We are not liable for allergic reactions where allergen information has been provided, delays caused by third-party couriers, damage occurring after delivery is completed, or indirect or consequential losses.",
      "Our liability is limited to the value of the order placed.",
    ],
  },
  {
    title: "11. Intellectual Property",
    paragraphs: [
      "All content on our website, including branding, images, product names, and designs, is the property of Grown Cookies.",
      "You may not reproduce or use our branding without written permission.",
    ],
  },
  {
    title: "12. Privacy",
    paragraphs: [
      "We handle customer data in accordance with UK GDPR regulations.",
      "Personal information is used solely for processing orders, delivery purposes, and customer service communication.",
      "We do not sell personal data to third parties.",
    ],
  },
  {
    title: "13. Changes to Terms",
    paragraphs: [
      "We reserve the right to update these terms at any time. Changes take effect immediately upon being posted on our website.",
    ],
  },
  {
    title: "14. Governing Law",
    paragraphs: [
      "These terms are governed by the laws of Scotland and the United Kingdom, and any disputes are subject to the jurisdiction of Scottish courts.",
    ],
  },
  {
    title: "Contact Us",
    paragraphs: ["If you have any questions about these terms, please contact orders@growncookies.co.uk."],
  },
];

function renderParagraph(paragraph: string) {
  if (!paragraph.includes("orders@growncookies.co.uk")) {
    return paragraph;
  }

  const email = "orders@growncookies.co.uk";
  const parts = paragraph.split(email);

  return (
    <>
      {parts[0]}
      <a href={`mailto:${email}`}>{email}</a>
      {parts[1]}
    </>
  );
}

export default async function TermsPage() {
  const [deliveryCostSetting, dispatchSettings] = await Promise.all([
    getDeliveryCostSetting(),
    getDispatchSettings(),
  ]);
  const shippingSections = [
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
          <h1>Terms of Service</h1>

          {termsSections.map((section) => (
            <article key={section.title} className={`${styles.termsItem} whiteFrame`}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{renderParagraph(paragraph)}</p>
              ))}
            </article>
          ))}

          <p className={styles.groupHeading}>Shipping Policy</p>

          {shippingSections.map((section) => (
            <article key={section.title} className={`${styles.termsItem} whiteFrame`}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{renderParagraph(paragraph)}</p>
              ))}
              {section.bulletPoints ? (
                <ul className={styles.cookieBulletList}>
                  {section.bulletPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
              {section.closingParagraphs?.map((paragraph) => (
                <p key={paragraph}>{renderParagraph(paragraph)}</p>
              ))}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
