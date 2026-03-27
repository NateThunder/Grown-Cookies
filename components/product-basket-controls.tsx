"use client";

import { useState } from "react";
import { FiShoppingBag } from "react-icons/fi";
import type { ShopProduct } from "@/lib/products";
import { addToBasket } from "@/lib/basket-storage";
import styles from "./product-basket-controls.module.css";

type ProductBasketControlsProps = {
  product: Pick<ShopProduct, "slug" | "name" | "price" | "image" | "imageAlt" | "isGiftCard">;
};

export default function ProductBasketControls({ product }: ProductBasketControlsProps) {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const increase = () => setQuantity((value) => Math.min(value + 1, 99));
  const decrease = () => setQuantity((value) => Math.max(value - 1, 1));

  const handleAdd = () => {
    addToBasket(product, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1100);
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.purchaseRow}>
        <div className={styles.quantityControl} aria-label="Quantity selector">
          <button type="button" aria-label="Decrease quantity" onClick={decrease}>
            -
          </button>
          <span>{quantity}</span>
          <button type="button" aria-label="Increase quantity" onClick={increase}>
            +
          </button>
        </div>

        <button type="button" className={styles.addToCart} onClick={handleAdd}>
          <FiShoppingBag />
          {justAdded ? "Added to basket" : "Add to basket"}
        </button>
      </div>
    </section>
  );
}
