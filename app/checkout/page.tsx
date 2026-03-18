import SiteHeader from "@/components/site-header";
import CheckoutClient from "@/components/checkout-client";
import styles from "./page.module.css";

export default function CheckoutPage() {
  return (
    <main className={styles.page}>
      <SiteHeader />
      <CheckoutClient />
    </main>
  );
}
