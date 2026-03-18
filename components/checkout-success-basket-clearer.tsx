"use client";

import { useEffect } from "react";
import { clearBasket } from "@/lib/basket-storage";

type CheckoutSuccessBasketClearerProps = {
  shouldClearBasket: boolean;
};

export default function CheckoutSuccessBasketClearer({
  shouldClearBasket,
}: CheckoutSuccessBasketClearerProps) {
  useEffect(() => {
    if (shouldClearBasket) {
      clearBasket();
    }
  }, [shouldClearBasket]);

  return null;
}
