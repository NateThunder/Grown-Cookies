import Link from "next/link";
import PrivacyCookiePreferences from "@/components/privacy-cookie-preferences";
import SiteHeader from "@/components/site-header";
import styles from "../legal.module.css";

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <SiteHeader variant="hero" showAnnouncement={false} />
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Privacy Policy</p>
          <h1>Your data, handled carefully.</h1>
          <p className={styles.description}>
            Grown Cookies uses the information you provide to process orders,
            manage your account, respond to enquiries, and improve the shopping
            experience across our website.
          </p>
        </div>

        <article className={`${styles.panel} whiteFrame`}>
          <div className={styles.section}>
            <h2>What we collect</h2>
            <p>
              We may collect your name, email address, phone number, delivery
              details, order history, and any information you submit through
              account creation, checkout, or contact forms.
            </p>
          </div>

          <div className={styles.section}>
            <h2>How we use it</h2>
            <p>
              We use your information to fulfil orders, provide customer
              support, send account-related updates, and maintain the security
              of the website. If you choose social login, we may receive basic
              profile information from that provider.
            </p>
          </div>

          <div className={styles.section}>
            <h2>Sharing</h2>
            <p>
              We only share data with service providers needed to operate the
              store, such as payment, hosting, authentication, analytics, and
              delivery platforms. We do not sell your personal information.
            </p>
          </div>

          <div className={styles.section}>
            <h2>Cookies and analytics</h2>
            <p>
              Essential storage is used to keep your basket, account, and
              checkout working. Optional Google Analytics only loads if you
              allow analytics cookies, and you can change that choice here at
              any time.
            </p>
            <PrivacyCookiePreferences />
          </div>

          <div className={styles.section}>
            <h2>Your choices</h2>
            <p>
              You can request access, correction, or deletion of your personal
              data by contacting us through the <Link href="/contact">contact page</Link>.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
