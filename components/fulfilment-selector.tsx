"use client";

import { useEffect, useId, useState } from "react";
import {
  BAKERY_COLLECTION_METHOD,
  UK_POSTAL_SHIPPING_METHOD,
  type DispatchMethod,
} from "@/lib/dispatch";
import {
  DISPATCH_UPDATED_EVENT,
  getDispatchSelection,
  setFulfilmentSelection,
} from "@/lib/dispatch-storage";
import styles from "./fulfilment-selector.module.css";

export default function FulfilmentSelector({ compact = false }: { compact?: boolean }) {
  const [method, setMethod] = useState<DispatchMethod>(UK_POSTAL_SHIPPING_METHOD);
  const groupName = useId();

  useEffect(() => {
    const refresh = () => setMethod(getDispatchSelection()?.method ?? UK_POSTAL_SHIPPING_METHOD);
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(DISPATCH_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(DISPATCH_UPDATED_EVENT, refresh);
    };
  }, []);

  const choose = (nextMethod: DispatchMethod) => {
    const scheduledDate = getDispatchSelection()?.scheduledDate ?? "";
    setFulfilmentSelection(nextMethod, scheduledDate);
    setMethod(nextMethod);
  };

  return (
    <fieldset className={compact ? styles.compact : styles.selector}>
      <legend>Order for</legend>
      <label data-active={method === UK_POSTAL_SHIPPING_METHOD}>
        <input
          type="radio"
          name={`fulfilment-${groupName}`}
          checked={method === UK_POSTAL_SHIPPING_METHOD}
          onChange={() => choose(UK_POSTAL_SHIPPING_METHOD)}
        />
        <span>Delivery</span>
      </label>
      <label data-active={method === BAKERY_COLLECTION_METHOD}>
        <input
          type="radio"
          name={`fulfilment-${groupName}`}
          checked={method === BAKERY_COLLECTION_METHOD}
          onChange={() => choose(BAKERY_COLLECTION_METHOD)}
        />
        <span>Collection</span>
      </label>
    </fieldset>
  );
}
