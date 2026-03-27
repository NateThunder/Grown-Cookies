import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export default function ContactPage() {
  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="contact" />

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

        <form className={styles.contactForm}>
          <div className={styles.formRow}>
            <input
              type="text"
              name="name"
              placeholder="Name"
              aria-label="Name"
              className={styles.input}
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              aria-label="Email"
              className={styles.input}
            />
          </div>

          <input
            type="tel"
            name="phone"
            placeholder="Phone"
            aria-label="Phone"
            className={styles.input}
          />

          <textarea
            name="comment"
            placeholder="Comment"
            aria-label="Comment"
            className={styles.textarea}
          />

          <button type="submit" className={styles.submitButton}>
            Submit
          </button>
        </form>
      </section>
    </main>
  );
}
