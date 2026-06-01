import Link from "next/link";
import type { IconType } from "react-icons";
import { FiClock, FiGift, FiTruck } from "react-icons/fi";
import { getAllProducts, type ShopProduct } from "@/lib/products";
import { getDeliveryBannerSetting, type DeliveryBannerIcon } from "@/lib/store-settings";
import MobileNav from "@/components/mobile-nav";
import SearchModalTrigger from "@/components/search-modal-trigger";
import BasketLink from "@/components/basket-link";
import HeaderAccountLink from "@/components/header-account-link";
import ShopNowLink from "@/components/shop-now-link";
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

const accountNavItems = [
  { href: "/account#profile", label: "Profile" },
  { href: "/account#security", label: "Security" },
  { href: "/account#addresses", label: "Addresses" },
  { href: "/account#payments", label: "Payments" },
  { href: "/account#notifications", label: "Notifications" },
  { href: "/account#orders", label: "Order history" },
];

const announcementIcons: Record<DeliveryBannerIcon, IconType> = {
  truck: FiTruck,
  clock: FiClock,
  gift: FiGift,
};

export default async function SiteHeader({
  activeRoute,
  products: providedProducts,
  showAnnouncement = true,
  variant = "solid",
}: SiteHeaderProps) {
  const [products, deliveryBannerSetting] = await Promise.all([
    providedProducts ? Promise.resolve(providedProducts) : getAllProducts(),
    showAnnouncement ? getDeliveryBannerSetting() : Promise.resolve(null),
  ]);
  const AnnouncementIcon = deliveryBannerSetting
    ? announcementIcons[deliveryBannerSetting.icon]
    : FiTruck;
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
            <MobileNav items={mobileNavItems} accountItems={accountNavItems} />
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
            <ShopNowLink className={styles.shopNowLink}>
              Shop now
            </ShopNowLink>
            <div className={styles.utilityLinks}>
              <div className={styles.desktopSearch}>
                <SearchModalTrigger products={products} />
              </div>
              <HeaderAccountLink />
              <BasketLink position="top" />
            </div>
          </div>
        </div>
      </header>

      {showAnnouncement && deliveryBannerSetting ? (
        <div className={styles.announcement}>
          <AnnouncementIcon className={styles.announcementIcon} aria-hidden="true" />
          <span>{deliveryBannerSetting.text}</span>
        </div>
      ) : null}
    </>
  );
}
