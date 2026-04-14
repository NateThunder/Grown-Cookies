import Link from "next/link";
import SiteHeader from "@/components/site-header";
import styles from "../legal.module.css";

export default function DataDeletionPage() {
  return (
    <main className={styles.page}>
      <SiteHeader variant="hero" showAnnouncement={false} />
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Data Deletion</p>
          <h1>How to request deletion.</h1>
          <p className={styles.description}>
            If you created an account with Facebook or provided personal data to
            Grown Cookies, you can request deletion of that data at any time.
          </p>
        </div>

        <article className={`${styles.panel} whiteFrame`}>
          <div className={styles.section}>
            <h2>Request process</h2>
            <p>
              Send a deletion request using the <Link href="/contact">contact page</Link>
              and include the email address connected to your account.
            </p>
          </div>

          <div className={styles.section}>
            <h2>What we delete</h2>
            <p>
              Once we verify the request, we will remove or anonymise account
              details and associated personal data that we are not required to
              retain for legal, tax, fraud-prevention, or order-record purposes.
            </p>
          </div>

          <div className={styles.section}>
            <h2>Timing</h2>
            <p>
              We aim to process verified deletion requests within 30 days.
              Where retention is legally required, we will keep only the minimum
              information necessary for compliance.
            </p>
          </div>

          <div className={styles.section}>
            <h2>Questions</h2>
            <p>
              If you need help with an existing account or Facebook-linked sign
              in, contact us through <Link href="/contact">/contact</Link> and we will help.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
