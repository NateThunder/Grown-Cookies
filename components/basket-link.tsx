"use client";

import { useEffect, useState } from "react";
import { FiShoppingBag, FiX } from "react-icons/fi";
import { BASKET_UPDATED_EVENT, getBasketQuantity } from "@/lib/basket-storage";
import CartClient from "@/components/cart-client";
import styles from "./basket-link.module.css";

type BasketLinkPosition = "top" | "floating" | "both";

type BasketLinkProps = {
  position?: BasketLinkPosition;
};

export default function BasketLink({ position = "top" }: BasketLinkProps) {
  const [itemCount, setItemCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const hasTopTrigger = position === "top" || position === "both";
  const hasFloatingTrigger = position === "floating" || position === "both";

  useEffect(() => {
    const refreshCount = () => setItemCount(getBasketQuantity());

    refreshCount();
    const handleUpdate = () => refreshCount();

    window.addEventListener("storage", handleUpdate);
    window.addEventListener(BASKET_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(BASKET_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const label = itemCount === 1 ? "1 item" : `${itemCount} items`;

  return (
    <>
      {hasTopTrigger && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-label={`Open basket (${label})`}
          className={`${styles.link} ${styles.top}`}
        >
          <FiShoppingBag />
          {itemCount > 0 ? <span className={styles.badge}>{itemCount}</span> : null}
        </button>
      )}
      {hasFloatingTrigger && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-label={`Open basket (${label})`}
          className={`${styles.link} ${styles.floating}`}
        >
          <FiShoppingBag />
          {itemCount > 0 ? <span className={styles.badge}>{itemCount}</span> : null}
        </button>
      )}

      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ""}`.trim()}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ""}`.trim()}
        aria-label="Basket"
        aria-hidden={!isOpen}
      >
        <div className={styles.drawerHeader}>
          <span>{`Your Basket (${itemCount})`}</span>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close basket">
            <FiX />
          </button>
        </div>

        <div className={styles.drawerContent}>
          {isOpen ? (
            <CartClient className={styles.cartInsideDrawer} layout="drawer" showTitle={false} />
          ) : null}
        </div>
      </aside>
    </>
  );
}
