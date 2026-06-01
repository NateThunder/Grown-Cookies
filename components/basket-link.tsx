"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiShoppingBag, FiX } from "react-icons/fi";
import { BASKET_UPDATED_EVENT, getBasketQuantity } from "@/lib/basket-storage";
import CartClient from "@/components/cart-client";
import styles from "./basket-link.module.css";

type BasketLinkPosition = "top" | "floating" | "both";
const OPEN_BASKET_EVENT = "grown-cookies:open-basket";

type BasketLinkProps = {
  position?: BasketLinkPosition;
  renderDrawer?: boolean;
  triggerGlobalDrawer?: boolean;
};

export default function BasketLink({
  position = "top",
  renderDrawer = true,
  triggerGlobalDrawer = false,
}: BasketLinkProps) {
  const [itemCount, setItemCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const hasTopTrigger = position === "top" || position === "both";
  const hasFloatingTrigger = position === "floating" || position === "both";

  const openBasket = () => {
    if (triggerGlobalDrawer) {
      window.dispatchEvent(new Event(OPEN_BASKET_EVENT));
      return;
    }

    setIsOpen(true);
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
    if (!renderDrawer) {
      return;
    }

    const handleOpenBasket = () => setIsOpen(true);

    window.addEventListener(OPEN_BASKET_EVENT, handleOpenBasket);

    return () => {
      window.removeEventListener(OPEN_BASKET_EVENT, handleOpenBasket);
    };
  }, [renderDrawer]);

  useEffect(() => {
    if (!renderDrawer || !isOpen) {
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
  const floatingTrigger = (
    <button
      type="button"
      onClick={openBasket}
      aria-expanded={isOpen}
      aria-label={`Open basket (${label})`}
      className={`${styles.link} ${styles.floating}`}
    >
      <FiShoppingBag />
      {itemCount > 0 ? <span className={styles.badge}>{itemCount}</span> : null}
    </button>
  );
  const drawerUi = (
    <>
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

  return (
    <>
      {hasTopTrigger && (
        <button
          type="button"
          onClick={openBasket}
          aria-expanded={isOpen}
          aria-label={`Open basket (${label})`}
          className={`${styles.link} ${styles.top}`}
        >
          <FiShoppingBag />
          {itemCount > 0 ? <span className={styles.badge}>{itemCount}</span> : null}
        </button>
      )}
      {hasFloatingTrigger && hasMounted ? createPortal(floatingTrigger, document.body) : null}

      {renderDrawer && hasMounted ? createPortal(drawerUi, document.body) : null}
    </>
  );
}
