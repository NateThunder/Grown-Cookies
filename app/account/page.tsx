import SiteHeader from "@/components/site-header";
import AccountPageClient from "@/components/account-page-client";
import styles from "./page.module.css";

export default function AccountPage() {
  return (
    <main className={`${styles.page} account-page`}>
      <SiteHeader variant="hero" showAnnouncement={false} />
      <AccountPageClient />
    </main>
  );
}
