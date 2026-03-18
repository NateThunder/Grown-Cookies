import { getDeliveryCostCents } from "@/lib/store-settings";
import SiteHeader from "@/components/site-header";
import CheckoutClient from "@/components/checkout-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const shippingCents = await getDeliveryCostCents();

  return (
    <main className={styles.page}>
      <SiteHeader showAnnouncement={false} />
      <CheckoutClient shippingCents={shippingCents} />
    </main>
  );
}
