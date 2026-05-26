"use client";

import { useEffect } from "react";
import { clearBasket } from "@/lib/basket-storage";

type CheckoutSuccessBasketClearerProps = {
  shouldClearBasket: boolean;
  shouldClearGiftCards?: boolean;
};

export default function CheckoutSuccessBasketClearer({
  shouldClearBasket,
  shouldClearGiftCards = true,
}: CheckoutSuccessBasketClearerProps) {
  useEffect(() => {
    if (shouldClearBasket) {
      clearBasket();
    }

    if (shouldClearGiftCards) {
      window.sessionStorage.removeItem("grown-cookies-checkout-gift-cards");
    }
  }, [shouldClearBasket, shouldClearGiftCards]);

  return null;
}
