"use client";

import { useFormStatus } from "react-dom";
import styles from "./admin-product-form.module.css";

export default function AdminDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.deleteButton} disabled={pending}>
      {pending ? "Deleting..." : "Delete product"}
    </button>
  );
}
