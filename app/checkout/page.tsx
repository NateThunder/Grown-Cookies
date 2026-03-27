import SiteHeader from "@/components/site-header";
import CheckoutClient from "@/components/checkout-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <main className={styles.page}>
      <SiteHeader showAnnouncement={false} />
      <CheckoutClient />
    </main>
  );
}
