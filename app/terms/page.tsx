import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

const termsSections = [
  {
    title: "Terms and Conditions",
    paragraphs: [
      "Last updated: April 2026",
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

const shippingSections = [
  {
    title: "Shipping Policy",
    paragraphs: [
      "Last updated: April 2026",
      "This Shipping Policy explains how we process, dispatch, and deliver orders placed with Grown Cookies.",
    ],
  },
  {
    title: "1. Shipping Method",
    paragraphs: [
      "All orders are shipped using Royal Mail Tracked 24.",
      "This service provides fully tracked delivery, a delivery aim of 1 business day after dispatch, photo proof of delivery where available, and SMS or email tracking updates.",
    ],
  },
  {
    title: "2. Dispatch Times",
    paragraphs: [
      "Orders are typically processed and baked within 1-3 business days.",
      "Orders are dispatched Monday to Friday, excluding UK public holidays.",
      "We do not dispatch on weekends.",
      "You will receive a confirmation email once your order has been dispatched.",
    ],
  },
  {
    title: "3. Delivery Timeframes",
    paragraphs: [
      "Once dispatched via Royal Mail Tracked 24, delivery is usually within 1 business day.",
      "In some cases, delivery may take 1-2 business days.",
      "Delivery times are estimates and may vary due to postal delays, weather conditions, or peak seasonal periods.",
    ],
  },
  {
    title: "4. Shipping Costs",
    paragraphs: [
      "Shipping is charged at a flat rate of £4.95 per order.",
      "This includes packaging, handling, and Royal Mail Tracked 24 delivery.",
      "We may occasionally offer free shipping promotions, which will be clearly stated on our website.",
    ],
  },
  {
    title: "5. Delivery Areas",
    paragraphs: [
      "We currently deliver to mainland United Kingdom, Northern Ireland, and the Scottish Highlands and Islands, which may experience longer delivery times.",
      "We do not currently offer international shipping.",
    ],
  },
  {
    title: "6. Order Tracking",
    paragraphs: [
      "All orders are fully trackable.",
      "Once your order has been dispatched, you will receive a tracking number via email or SMS so you can follow your delivery via Royal Mail’s tracking system.",
    ],
  },
  {
    title: "7. Delivery Responsibility",
    paragraphs: [
      "Once an order has been marked as delivered by Royal Mail, responsibility for the parcel transfers to the customer.",
      "We are not responsible for packages lost or stolen after confirmed delivery or for incorrect delivery addresses provided by the customer.",
      "Please ensure your delivery details are accurate at checkout.",
    ],
  },
  {
    title: "8. Failed Deliveries",
    paragraphs: [
      "If delivery is unsuccessful, Royal Mail may attempt re-delivery or leave a collection notice.",
      "It is the customer’s responsibility to follow up with Royal Mail.",
      "We are not responsible for delays caused by missed delivery attempts.",
    ],
  },
  {
    title: "9. Perishable Goods Notice",
    paragraphs: [
      "Our cookies are freshly baked and perishable.",
      "We recommend opening your parcel as soon as it is delivered and following any storage or reheating instructions included in your order.",
      "We are not responsible for product quality deterioration after delivery has been completed.",
    ],
  },
  {
    title: "10. Order Changes & Address Accuracy",
    paragraphs: [
      "Once an order has been placed, we cannot guarantee changes to delivery address or order details.",
      "Customers must ensure all information is correct at checkout.",
      "We are not responsible for delays or losses caused by incorrect addresses.",
    ],
  },
  {
    title: "11. Contact Us",
    paragraphs: ["If you have any questions regarding shipping, please contact orders@growncookies.co.uk."],
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

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <SiteHeader variant="hero" showAnnouncement={false} />

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
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
