import Link from "next/link";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import styles from "@/app/shop/page.module.css";

type SortOption = {
  value: string;
  label: string;
};

type ShopSortDropdownProps = {
  options: SortOption[];
  activeSort: string;
};

function getSortHref(sort: string) {
  return sort === "manual" ? "/shop" : `/shop?sort=${sort}`;
}

export default function ShopSortDropdown({ options, activeSort }: ShopSortDropdownProps) {
  return (
    <details className={styles.sortMenu}>
      <summary className={styles.sortToggle}>
        <span>Sort</span>
        <FiChevronDown />
      </summary>
      <div id="shop-sort-options" className={styles.sortDropdown} role="menu">
        {options.map((option) => {
          const isActive = option.value === activeSort;

          return (
            <Link
              key={option.value}
              href={getSortHref(option.value)}
              className={`${styles.sortOption} ${isActive ? styles.sortOptionActive : ""}`.trim()}
              scroll={false}
              role="menuitem"
            >
              <span className={styles.sortCheck}>{isActive ? <FiCheck /> : null}</span>
              <span>{option.label}</span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}
