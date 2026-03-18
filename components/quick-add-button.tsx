"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { FiPlus, FiShoppingBag } from "react-icons/fi";
import { addToBasket } from "@/lib/basket-storage";
import type { ShopProduct } from "@/lib/products";

type QuickAddButtonProps = {
  product: Pick<ShopProduct, "slug" | "name" | "price" | "image" | "imageAlt">;
  className?: string;
  compact?: boolean;
};

export default function QuickAddButton({
  product,
  className = "",
  compact = false,
}: QuickAddButtonProps) {
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    addToBasket(
      {
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image,
        imageAlt: product.imageAlt,
      },
      1,
    );

    setJustAdded(true);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setJustAdded(false);
      timeoutRef.current = null;
    }, 1200);
  };

  return (
    <button
      type="button"
      className={className}
      aria-label={justAdded ? `${product.name} added to basket` : `Add ${product.name} to basket`}
      data-added={justAdded ? "true" : "false"}
      onClick={handleClick}
    >
      <FiShoppingBag />
      {compact ? <FiPlus /> : <span>{justAdded ? "Added" : "Add"}</span>}
    </button>
  );
}
