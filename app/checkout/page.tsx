import CheckoutClient from "@/components/checkout-client";
import styles from "./page.module.css";

export default function CheckoutPage() {
  return (
    <main className={styles.page}>
      <CheckoutClient />
    </main>
  );
}
