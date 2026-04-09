import Link from "next/link";
import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export default function FaqsPage() {
  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="faqs" variant="hero" showAnnouncement={false} />

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
            <p>We accept Visa, MasterCard and American Express.</p>
          </article>

          <article className={styles.faqItem}>
            <h2>I have entered an incorrect address what do I do now?</h2>
            <p>
              Simply reply to your order confirmation email and confirm. Once you double check if
              the address given is wrong kindly notify us via email at{" "}
              <a href="mailto:orders@growncookies.co.uk">orders@growncookies.co.uk</a>. If the
              given address is wrong we can change the address to the correct one within 24 hours.
              No refund will be given after the 24 hours of incorrect submission.
            </p>
          </article>

          <article className={styles.faqItem}>
            <h2>SHIPPING + DELIVERY</h2>
            <p>
              We will select the best carrier and method of shipping based on the size and weight
              of the products you order.
            </p>
            <p>
              Please allow 2 days production time for your order to ship out. Average shipping
              times are 1-3 days based on location. Tracking numbers will be updated 3-5 days
              after your order has been shipped. Back ordered items will only be charged once they
              have been dispatched. Delivery service is to your door.
            </p>
          </article>

          <article className={styles.faqItem}>
            <h2>RETURN</h2>
            <p>
              All cookies are baked to order and we do not accept returns. As all items are fresh
              baked, we do not offer refunds due to the perishable nature of the products. Credit
              notes or a replacement order to the same value of your items will be given only in
              the event that you receive the incorrect product.
            </p>
            <p>
              Should this be the case, or if you are in any way unsatisfied with the condition or
              quality of your cookies upon arrival, you must contact us within 24 hours of receipt.
              Grown Cookies will not accept liability for any complaints made after this time. You
              can reach us through the <Link href="/contact">contact page</Link>.
            </p>
          </article>

          <article className={styles.faqItem}>
            <h2>DAMAGED GOODS</h2>
            <p>
              If in the event our items arrived damaged in transit, it is the customer&apos;s
              responsibility to provide full photographic evidence to show the condition of the item
              including the packaging so that we can investigate further.
            </p>
          </article>

          <article className={styles.faqItem}>
            <h2>PRIVACY AND SECURITY</h2>
            <p>
              We are committed to respecting your privacy. We do not sell or disclose our customer
              information to other sources. During a sales transaction, your credit card
              information, if submitted, is never stored. Any information we collect from you is
              solely for the processing of your order.
            </p>
            <p>
              If you choose to sign up for our mailing list, on occasion we will send you targeted
              marketing information or special product offers. In every marketing email you will
              have the option to unsubscribe and avoid receiving future emails from us.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
