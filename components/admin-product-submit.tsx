"use client";

import { useFormStatus } from "react-dom";
import styles from "./admin-product-form.module.css";

type AdminProductSubmitProps = {
  idleLabel: string;
  pendingLabel: string;
  idleNote: string;
  pendingNote: string;
};

export default function AdminProductSubmit({
  idleLabel,
  pendingLabel,
  idleNote,
  pendingNote,
}: AdminProductSubmitProps) {
  const { pending } = useFormStatus();

  return (
    <div className={styles.actionsRow}>
      <button type="submit" className={styles.submitButton} disabled={pending}>
        {pending ? pendingLabel : idleLabel}
      </button>
      <p className={styles.actionsNote} aria-live="polite">
        {pending ? pendingNote : idleNote}
      </p>
    </div>
  );
}
