import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import AccountPageClient from "@/components/account-page-client";
import styles from "./page.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <main className={`${styles.page} account-page`}>
      <SiteHeader variant="hero" />
      <AccountPageClient />
    </main>
  );
}
