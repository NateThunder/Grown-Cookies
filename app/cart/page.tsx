import SiteHeader from "@/components/site-header";
import CartClient from "@/components/cart-client";
import styles from "./page.module.css";

export default function CartPage() {
  return (
    <main className={styles.page}>
      <SiteHeader variant="hero" />
      <CartClient />
    </main>
  );
}
