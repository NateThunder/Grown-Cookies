"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/admin/page.module.css";

const COOKIE_OF_MONTH_SELECTION_EVENT = "gc:cookie-of-month-selection";

type AdminCookieOfMonthToggleProps = {
  action: (formData: FormData) => void | Promise<void>;
  productSlug: string;
  returnView: "all" | "featured";
  checked: boolean;
};

export default function AdminCookieOfMonthToggle({
  action,
  productSlug,
  returnView,
  checked,
}: AdminCookieOfMonthToggleProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectedValueRef = useRef<HTMLInputElement>(null);
  const [isChecked, setIsChecked] = useState(checked);

  useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  useEffect(() => {
    function handleSelection(event: Event) {
      const customEvent = event as CustomEvent<{ productSlug: string }>;

      if (customEvent.detail.productSlug !== productSlug) {
        setIsChecked(false);
      }
    }

    window.addEventListener(COOKIE_OF_MONTH_SELECTION_EVENT, handleSelection as EventListener);

    return () => {
      window.removeEventListener(COOKIE_OF_MONTH_SELECTION_EVENT, handleSelection as EventListener);
    };
  }, [productSlug]);

  function handleChange(nextChecked: boolean) {
    setIsChecked(nextChecked);
    if (selectedValueRef.current) {
      selectedValueRef.current.value = nextChecked ? "1" : "0";
    }

    if (nextChecked) {
      window.dispatchEvent(
        new CustomEvent(COOKIE_OF_MONTH_SELECTION_EVENT, {
          detail: { productSlug },
        }),
      );
    }

    formRef.current?.requestSubmit();
  }

  return (
    <form action={action} className={styles.tickboxForm} ref={formRef}>
      <input type="hidden" name="returnView" value={returnView} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input
        type="hidden"
        name="cookieOfMonthSelected"
        value={isChecked ? "1" : "0"}
        ref={selectedValueRef}
      />
      <label className={styles.tickboxLabel}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(event) => handleChange(event.currentTarget.checked)}
        />
        <span>{isChecked ? "Selected" : "Set"}</span>
      </label>
    </form>
  );
}
