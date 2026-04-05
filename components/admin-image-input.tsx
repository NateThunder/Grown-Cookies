"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useState } from "react";
import styles from "./admin-product-form.module.css";

type AdminImageInputProps = {
  currentImageUrl?: string;
  currentImageAlt: string;
  required?: boolean;
  disabled?: boolean;
};

export default function AdminImageInput({
  currentImageUrl,
  currentImageAlt,
  required = false,
  disabled = false,
}: AdminImageInputProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.currentTarget.files?.[0];

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }

    if (!nextFile) {
      setSelectedFileName("");
      return;
    }

    setSelectedFileName(nextFile.name);
    setLocalPreviewUrl(URL.createObjectURL(nextFile));
  }

  const imageUrl = localPreviewUrl ?? currentImageUrl;

  return (
    <div className={styles.imageField}>
      <div className={styles.imagePreviewFrame}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={currentImageAlt}
            fill
            className={styles.imagePreview}
            sizes="(max-width: 960px) 100vw, 28rem"
          />
        ) : (
          <div className={styles.imagePreviewPlaceholder}>
            <span>No image uploaded yet</span>
          </div>
        )}
      </div>

      <label className={styles.filePicker}>
        <span>{disabled ? "Uploads unavailable" : "Choose a new image"}</span>
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleImageChange}
          required={required}
          disabled={disabled}
        />
      </label>

      <p className={styles.helperText}>
        {disabled
          ? "Add CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY to enable image uploads."
          : "Uploading a file replaces the product's current primary image in Cloudflare R2."}
      </p>

      {selectedFileName ? (
        <p className={styles.fileName}>Selected: {selectedFileName}</p>
      ) : null}
    </div>
  );
}
