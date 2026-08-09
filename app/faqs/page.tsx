import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/json-ld";
import SiteHeader from "@/components/site-header";
import { getBreadcrumbJsonLd, getFaqJsonLd } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Cookie Delivery, Storage & Allergen FAQs | Grown Cookies" },
  description:
    "Answers about Grown Cookies UK delivery, Glasgow collection, gifting, storage, allergens, payments and order changes.",
  alternates: { canonical: "/faqs" },
};

const FAQ_ITEMS = [
  {
    question: "Where do you deliver Grown Cookies?",
    answer: "We send selected products throughout the UK using Royal Mail Tracked 24. Choose an available dispatch date during checkout.",
  },
  {
    question: "Does same-day dispatch mean same-day delivery?",
    answer: "No. Eligible orders placed before the published cutoff on an available dispatch day can enter the Royal Mail network that day. Delivery normally follows within one working day, but it is not guaranteed and delays can occur.",
  },
  {
    question: "Can I collect cookies in Glasgow?",
    answer: "Yes. Pre-order online, choose Collection and select an available date. Collection is from Akara Bakery, 537 Duke Street, Glasgow, G31 1DL, during the window shown at checkout.",
  },
  {
    question: "Can I walk in and buy Grown Cookies?",
    answer: "Grown Cookies are made to order, so please order online and choose a collection date before travelling.",
  },
  {
    question: "How many cookies are in a box?",
    answer: "Each physical Grown Cookies box contains six made-to-order cookies.",
  },
  {
    question: "Can I send a cookie box as a gift?",
    answer: "Yes. Every physical cookie box can be sent as a gift. Add the optional personalised notecard for £3.50 on the product page before adding the box to your basket.",
  },
  {
    question: "How should I store and reheat the cookies?",
    answer: "Store the cookies in an airtight container and enjoy them within four days. To warm them, place them in the oven for around five minutes and allow them to cool slightly before eating.",
  },
  {
    question: "Where can I find allergen information?",
    answer: "Allergen information is displayed on each product page. The bakery environment handles multiple allergens, so contact us before ordering if you need further information.",
  },
  {
    question: "Which payment methods do you accept?",
    answer: "We accept Visa, Mastercard and American Express through our secure online checkout.",
  },
  {
    question: "What should I do if I entered the wrong delivery address?",
    answer: "Reply to your order confirmation email or contact orders@growncookies.co.uk immediately. We can only change the address before the order has been prepared for dispatch.",
  },
  {
    question: "Can fresh cookie orders be returned?",
    answer: "Fresh food cannot normally be returned. If your order is incorrect, damaged or not in the expected condition, contact us within 24 hours of delivery and include photographs where relevant.",
  },
];

export default function FaqsPage() {
  return (
    <main className={styles.page}>
      <JsonLd data={[
        getBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "FAQs", path: "/faqs" }]),
        getFaqJsonLd(FAQ_ITEMS),
      ]} />
      <SiteHeader activeRoute="faqs" variant="hero" />

      <section className={styles.faqSection}>
        <div className={styles.contentWrap}>
          <h1>FAQ&apos;s</h1>

          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className={`${styles.faqItem} whiteFrame`}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}

          <article className={`${styles.faqItem} whiteFrame`}>
            <h2>Still need help?</h2>
            <p>
              Use the <Link href="/contact">contact page</Link>, read the detailed{" "}
              <Link href="/delivery">delivery information</Link> or learn about{" "}
              <Link href="/cookies-glasgow">Glasgow collection</Link>.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
