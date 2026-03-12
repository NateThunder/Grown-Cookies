import SiteHeader from "@/components/site-header";
import AccountSignupForm from "@/components/account-signup-form";
import styles from "./page.module.css";

const perks = [
  "Save your details for faster checkout next time.",
  "Track upcoming orders and seasonal drops in one place.",
  "Get early access to limited-edition cookie launches.",
];

export default function AccountPage() {
  return (
    <main className={styles.page}>
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Customer accounts</p>
          <h1>Create your Grown Cookies account</h1>
          <p className={styles.description}>
            Register once to make reordering simpler and give customers a clear
            home for future order history, exclusives, and updates.
          </p>

          <ul className={styles.perks}>
            {perks.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelEyebrow}>Sign up</p>
            <h2>Start with email and password</h2>
            <p>
              This uses Supabase Auth. New customers will receive an email
              confirmation link after they register.
            </p>
          </div>

          <AccountSignupForm />
        </div>
      </section>
    </main>
  );
}
