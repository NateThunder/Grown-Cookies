import Link from "next/link";
import { getAllProducts, type ShopProduct } from "@/lib/products";
import MobileNav from "@/components/mobile-nav";
import SearchModalTrigger from "@/components/search-modal-trigger";
import BasketLink from "@/components/basket-link";
import HeaderAccountLink from "@/components/header-account-link";
import styles from "./site-header.module.css";

type NavRoute = "home" | "shop" | "contact" | "faqs";

type SiteHeaderProps = {
  activeRoute?: NavRoute;
  products?: ShopProduct[];
  showAnnouncement?: boolean;
  variant?: "solid" | "hero";
};

const desktopNavItems: Array<{ href: string; label: string; activeRoutes?: NavRoute[] }> = [
  { href: "/", label: "HOME", activeRoutes: ["home"] },
  { href: "/shop", label: "SHOP", activeRoutes: ["shop"] },
  { href: "/contact", label: "CONTACT US", activeRoutes: ["contact"] },
  { href: "/faqs", label: "FAQ's", activeRoutes: ["faqs"] },
];

export default async function SiteHeader({
  activeRoute,
  products: providedProducts,
  showAnnouncement = true,
  variant = "solid",
}: SiteHeaderProps) {
  const products = providedProducts ?? (await getAllProducts());
  const isHeroVariant = variant === "hero";
  const isRouteActive = (itemRoutes?: NavRoute[]) =>
    activeRoute ? itemRoutes?.includes(activeRoute) ?? false : false;
  const mobileNavItems = desktopNavItems.map((item) => ({
    href: item.href,
    label: item.label,
    isActive: isRouteActive(item.activeRoutes),
  }));

  return (
    <>
      <header
        className={`${styles.header} ${
          isHeroVariant ? styles.headerHero : styles.headerSolid
        }`.trim()}
      >
        <div className={styles.headerInner}>
          <div className={styles.mobileLeftActions}>
            <MobileNav items={mobileNavItems} />
            <div className={styles.mobileSearch}>
              <SearchModalTrigger products={products} />
            </div>
          </div>

          <Link href="/" className={styles.logo} aria-label="Grown Cookies home">
            <span className={styles.logoWordmark}>
              <span className={styles.logoMain}>
                grown
                <br />
                cookies
              </span>
              <span className={styles.logoTagline}>flavour refined</span>
            </span>
          </Link>

          <nav className={styles.leftNav} aria-label="Primary navigation">
            {desktopNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isRouteActive(item.activeRoutes) ? styles.navLinkActive : ""}`.trim()}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.iconNav} aria-label="Actions">
            <Link href="/shop" className={styles.shopNowLink}>
              Shop now
            </Link>
            <div className={styles.utilityLinks}>
              <div className={styles.desktopSearch}>
                <SearchModalTrigger products={products} />
              </div>
              <HeaderAccountLink />
              <BasketLink position="both" />
            </div>
          </div>
        </div>
      </header>

      {showAnnouncement ? (
        <div className={styles.announcement}>Freshly baked flavours. Nationwide delivery.</div>
      ) : null}
    </>
  );
}
