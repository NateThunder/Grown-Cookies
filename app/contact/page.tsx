import SiteHeader from "@/components/site-header";
import styles from "./page.module.css";

export default function ContactPage() {
  return (
    <main className={styles.page}>
      <SiteHeader activeRoute="contact" />

      <section className={styles.contactSection}>
        <h1>CONTACT US</h1>

        <div className={styles.contentWrap}>
          <h2>
            We Want To Hear
            <br />
            From You
          </h2>

          <p className={styles.bodyText}>
            Please feel free to <strong>Email:</strong>
            <br />
            <a href="mailto:orders@growncookies.co.uk">orders@growncookies.co.uk</a>{" "}
            or just speak your mind below. We love to talk about all things
            cookies!
            <br />
            Please allow 1 Business day to respond.
          </p>

          <h3>INQUIRIES</h3>
          <p className={styles.bodyText}>
            For all event, wedding and corporate, enquiries, or product
            questions you may have, please fill out the contact form or{" "}
            <strong>Email:</strong>
            <br />
            <a href="mailto:orders@growncookies.co.uk">orders@growncookies.co.uk</a>.
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
