import Link from "next/link";
import { getAllProducts, type ShopProduct } from "@/lib/products";
import SearchModalTrigger from "@/components/search-modal-trigger";
import { FiUser } from "react-icons/fi";
import BasketLink from "@/components/basket-link";
import styles from "./site-header.module.css";

type NavRoute = "home" | "shop" | "contact" | "faqs";

type SiteHeaderProps = {
  activeRoute?: NavRoute;
  products?: ShopProduct[];
};

const navItems: Array<{ href: string; label: string; route: NavRoute }> = [
  { href: "/", label: "HOME", route: "home" },
  { href: "/shop", label: "SHOP", route: "shop" },
  { href: "/contact", label: "CONTACT US", route: "contact" },
  { href: "/faqs", label: "FAQ's", route: "faqs" },
];

export default async function SiteHeader({ activeRoute, products: providedProducts }: SiteHeaderProps) {
  const products = providedProducts ?? (await getAllProducts());

  return (
    <>
      <header className={styles.header}>
        <nav className={styles.leftNav} aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${activeRoute === item.route ? styles.navLinkActive : ""}`.trim()}
            >
              {item.label}
            </Link>
          ))}
        </nav>

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

        <div className={styles.iconNav} aria-label="Actions">
          <SearchModalTrigger products={products} />
          <Link href="/account" aria-label="Account">
            <FiUser />
          </Link>
          <BasketLink />
        </div>
      </header>

      <BasketLink position="floating" />

      <div className={styles.announcement}>Shop our latest arrivals</div>
    </>
  );
}
