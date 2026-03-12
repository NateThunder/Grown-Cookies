import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export default function FaqsPage() {
  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="faqs" />

      <section className={styles.faqSection}>
        <div className={styles.contentWrap}>
          <h1>FAQ&apos;s</h1>

          <article className={styles.faqItem}>
            <h2>SHOP WITH CONFIDENCE</h2>
            <p>
              We guarantee that all of our products are beautiful and well made. As most of our
              products are handmade, please be prepared to accept some variations in the product.
              All product dimensions listed are approximate.
            </p>
          </article>

          <article className={styles.faqItem}>
            <h2>STORING &amp; CONSUMING COOKIES</h2>
            <p>
              Our cookies can be stored in an air-tight container. Your cookies should keep for up
              to 4 days, though we recommend eating them sooner if you can! To bring any cookie
              back to life just pop it in the oven for 5 minutes.
            </p>
          </article>

          <article className={styles.faqItem}>
            <h2>PAYMENT METHODS</h2>
          </article>
        </div>
      </section>
    </main>
  );
}
