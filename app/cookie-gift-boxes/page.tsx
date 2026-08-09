import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/json-ld";
import SiteHeader from "@/components/site-header";
import { getBreadcrumbJsonLd, getFaqJsonLd } from "@/lib/seo";
import styles from "../faqs/page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Cookie Gift Boxes Delivered UK | Grown Cookies" },
  description:
    "Send a made-to-order cookie gift box across the UK, with six thick cookies and an optional personalised notecard.",
  alternates: { canonical: "/cookie-gift-boxes" },
  openGraph: {
    title: "Cookie Gift Boxes Delivered UK | Grown Cookies",
    description: "Fresh cookie boxes for birthdays, celebrations, corporate gifts and events.",
    url: "/cookie-gift-boxes",
    type: "website",
  },
};

const GIFT_BOX_ITEMS = [
  {
    question: "Can any cookie box be sent as a gift?",
    answer: "Yes. Choose any physical cookie box and send it directly to the recipient's UK address.",
  },
  {
    question: "Can I add a personalised message?",
    answer: "Yes. Add the optional personalised notecard for £3.50 and enter your message on the product page before adding the box to your basket.",
  },
  {
    question: "How many cookies are in a gift box?",
    answer: "Each physical Grown Cookies box contains six made-to-order cookies.",
  },
  {
    question: "Do you deliver cookie gifts across the UK?",
    answer: "Yes. Eligible products are sent throughout the UK using Royal Mail Tracked 24. Choose an available dispatch date during checkout.",
  },
  {
    question: "Can I order gifts for a company, wedding or event?",
    answer: "Yes. Contact Grown Cookies with the date, quantity and event details so the bakery team can discuss a suitable order.",
  },
];

export default function CookieGiftBoxesPage() {
  return (
    <main className={styles.page}>
      <JsonLd data={[
        getBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Cookie Gift Boxes", path: "/cookie-gift-boxes" },
        ]),
        getFaqJsonLd(GIFT_BOX_ITEMS),
      ]} />
      <SiteHeader variant="hero" />

      <section className={styles.faqSection}>
        <div className={styles.contentWrap}>
          <h1>Cookie Gift Boxes</h1>
          <p className={styles.intro}>Send a made-to-order box of six cookies across the UK, with an optional personalised notecard.</p>

          {GIFT_BOX_ITEMS.map((item) => (
            <article key={item.question} className={`${styles.faqItem} whiteFrame`}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}

          <article className={`${styles.faqItem} whiteFrame`}>
            <h2>Ready to send a gift?</h2>
            <p><Link href="/shop">Choose a cookie box</Link> or <Link href="/contact">contact us about a larger order</Link>.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
