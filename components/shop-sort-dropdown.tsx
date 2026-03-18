"use client";

import { useEffect, useRef, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleOutsidePointerDown(event: PointerEvent) {
      const root = menuRef.current;
      if (!root) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !root.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className={`${styles.sortMenu} ${isOpen ? styles.sortMenuOpen : ""}`} ref={menuRef}>
      <button
        type="button"
        className={styles.sortToggle}
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-controls="shop-sort-options"
      >
        Sort
        <FiChevronDown />
      </button>
      {isOpen && (
        <div id="shop-sort-options" className={styles.sortDropdown} role="menu">
          {options.map((option) => {
            const isActive = option.value === activeSort;

            return (
              <Link
                key={option.value}
                href={getSortHref(option.value)}
                className={`${styles.sortOption} ${isActive ? styles.sortOptionActive : ""}`.trim()}
                onClick={() => setIsOpen(false)}
                scroll={false}
                role="menuitem"
              >
                <span className={styles.sortCheck}>{isActive ? <FiCheck /> : null}</span>
                <span>{option.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
