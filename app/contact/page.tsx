import SiteHeader from "@/components/site-header";
import ContactOrderForm from "@/components/contact-order-form";
import styles from "./page.module.css";

export default function ContactPage() {
  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="contact" variant="hero" showAnnouncement={false} />

      <section className={styles.contactSection}>
        <div className={styles.contentWrap}>
          <h1>Contact Us</h1>
          <p className={styles.introText}>
            Questions about events, weddings, corporate orders or products?
            Fill out the form below or email us at{" "}
            <a
              className={styles.emailLink}
              href="mailto:orders@growncookies.co.uk"
            >
              orders@growncookies.co.uk
            </a>
            . We usually reply within 1 business day.
          </p>
        </div>

        <ContactOrderForm />
      </section>
    </main>
  );
}
