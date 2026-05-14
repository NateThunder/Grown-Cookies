"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PRIMARY_PRODUCT_IMAGE_VARIANT,
  PRODUCT_IMAGE_VARIANT_FIELD_NAMES,
  PRODUCT_IMAGE_VARIANT_OPTIONS,
  PRODUCT_IMAGE_VARIANTS,
  type ProductImageCropState,
  type ProductImageVariant,
  type ProductImageVariantMap,
} from "@/lib/product-image-variants";
import styles from "./admin-product-form.module.css";

type AdminImageInputProps = {
  productId?: number;
  productSlug?: string;
  currentImageUrl?: string;
  currentImageAlt: string;
  required?: boolean;
  disabled?: boolean;
  canCropCurrentImage?: boolean;
  initialCropStates?: ProductImageVariantMap<ProductImageCropState>;
};

type CropState = {
  panX: number;
  panY: number;
  zoom: number;
  file?: File;
  previewUrl?: string;
};

type CropStates = Record<ProductImageVariant, CropState>;

type DragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
};

type CropSourceKind = "current" | "upload";

const PREVIEW_WIDTH = 720;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const variantOptions = PRODUCT_IMAGE_VARIANT_OPTIONS;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createInitialCropStates(
  initialCropStates?: ProductImageVariantMap<ProductImageCropState>,
): CropStates {
  return variantOptions.reduce((states, variant) => {
    const initialCropState = initialCropStates?.[variant.key];
    states[variant.key] = {
      panX: initialCropState ? clamp(initialCropState.panX, -1, 1) : 0,
      panY: initialCropState ? clamp(initialCropState.panY, -1, 1) : 0,
      zoom: initialCropState ? clamp(initialCropState.zoom, MIN_ZOOM, MAX_ZOOM) : 1,
    };
    return states;
  }, {} as CropStates);
}

function revokeCropPreviewUrls(cropStates: CropStates) {
  for (const cropState of Object.values(cropStates)) {
    if (cropState.previewUrl) {
      URL.revokeObjectURL(cropState.previewUrl);
    }
  }
}

function getBaseFileName(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "product-image"
  );
}

function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  variant: (typeof variantOptions)[number],
  cropState: CropState,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return { maxOffsetX: 0, maxOffsetY: 0 };
  }

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  const scale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight) * cropState.zoom;
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const maxOffsetX = Math.max(0, (drawWidth - canvasWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - canvasHeight) / 2);
  const offsetX = clamp(cropState.panX, -1, 1) * maxOffsetX;
  const offsetY = clamp(cropState.panY, -1, 1) * maxOffsetY;
  const drawX = (canvasWidth - drawWidth) / 2 + offsetX;
  const drawY = (canvasHeight - drawHeight) / 2 + offsetY;

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#f6eee9";
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return { maxOffsetX, maxOffsetY };
}

function createCroppedFile({
  sourceFileName,
  image,
  variant,
  cropState,
}: {
  sourceFileName: string;
  image: HTMLImageElement;
  variant: (typeof variantOptions)[number];
  cropState: CropState;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = variant.outputWidth;
  canvas.height = variant.outputHeight;
  drawCrop(canvas, image, variant, cropState);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The crop could not be created."));
          return;
        }

        resolve(
          new File([blob], `${getBaseFileName(sourceFileName)}-${variant.key}.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.92,
    );
  });
}

export default function AdminImageInput({
  productId,
  productSlug,
  currentImageUrl,
  currentImageAlt,
  required = false,
  disabled = false,
  canCropCurrentImage = false,
  initialCropStates,
}: AdminImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceFileRef = useRef<File | null>(null);
  const sourceFileNameRef = useRef(productSlug ?? "product-image");
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const sourceObjectUrlRef = useRef<string | null>(null);
  const cropSourceKindRef = useRef<CropSourceKind | null>(null);
  const cropStatesRef = useRef<CropStates>(createInitialCropStates(initialCropStates));
  const cropsAppliedRef = useRef(false);
  const cropDirtyRef = useRef(false);
  const dragStateRef = useRef<DragState | null>(null);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [sourceLoadFailed, setSourceLoadFailed] = useState(false);
  const [cropStates, setCropStatesState] = useState<CropStates>(() => cropStatesRef.current);
  const [activeVariant, setActiveVariant] = useState<ProductImageVariant>(
    PRODUCT_IMAGE_VARIANTS.homepagePolaroid.key,
  );
  const [cropsApplied, setCropsApplied] = useState(false);
  const [cropDirty, setCropDirty] = useState(false);
  const [cropSourceKind, setCropSourceKind] = useState<CropSourceKind | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [cropStatus, setCropStatus] = useState("");

  const activeVariantConfig = useMemo(
    () => variantOptions.find((variant) => variant.key === activeVariant) ?? variantOptions[0],
    [activeVariant],
  );
  const activeCropState = cropStates[activeVariant];
  const primaryPreviewUrl = cropStates[PRIMARY_PRODUCT_IMAGE_VARIANT].previewUrl;
  const imageUrl = primaryPreviewUrl ?? currentImageUrl;
  const currentCropSourceUrl = useMemo(() => {
    if (!canCropCurrentImage || disabled || !currentImageUrl || !productId) {
      return null;
    }

    const params = new URLSearchParams({ productId: String(productId) });
    return `/api/admin/product-image-source?${params.toString()}`;
  }, [canCropCurrentImage, currentImageUrl, disabled, productId]);
  const showCropCanvas = Boolean(sourceUrl && cropSourceKind && !sourceLoadFailed);
  const showCropControls = showCropCanvas && !disabled;
  const previewFrameClassName = `${styles.imagePreviewFrame} ${
    showCropCanvas ? styles.cropPreviewFrame : ""
  }`.trim();
  const helperText = disabled
    ? "Add CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY to enable image uploads."
    : currentCropSourceUrl
      ? "Adjust crops to update storefront image sections without replacing the main image, or choose a new image."
      : "Choose an image, then set crops for each storefront image section.";

  const setCropStates = useCallback((updater: (previous: CropStates) => CropStates) => {
    setCropStatesState((previous) => {
      const next = updater(previous);
      cropStatesRef.current = next;
      return next;
    });
  }, []);

  const setCropsAppliedState = useCallback((nextValue: boolean) => {
    cropsAppliedRef.current = nextValue;
    setCropsApplied(nextValue);
  }, []);

  const setCropDirtyState = useCallback((nextValue: boolean) => {
    cropDirtyRef.current = nextValue;
    setCropDirty(nextValue);
  }, []);

  const setCropSourceKindState = useCallback((nextValue: CropSourceKind | null) => {
    cropSourceKindRef.current = nextValue;
    setCropSourceKind(nextValue);
  }, []);

  const releaseSourceObjectUrl = useCallback(() => {
    if (sourceObjectUrlRef.current) {
      URL.revokeObjectURL(sourceObjectUrlRef.current);
      sourceObjectUrlRef.current = null;
    }
  }, []);

  const resetCropStates = useCallback(() => {
    revokeCropPreviewUrls(cropStatesRef.current);

    const nextCropStates = createInitialCropStates(initialCropStates);
    cropStatesRef.current = nextCropStates;
    setCropStatesState(nextCropStates);
  }, [initialCropStates]);

  const clearCropSource = useCallback(() => {
    releaseSourceObjectUrl();
    resetCropStates();

    sourceFileRef.current = null;
    sourceFileNameRef.current = productSlug ?? "product-image";
    sourceImageRef.current = null;
    setSourceUrl(null);
    setSourceReady(false);
    setSourceLoadFailed(false);
    setCropsAppliedState(false);
    setCropDirtyState(false);
    setCropSourceKindState(null);
    setSelectedFileName("");
    setCropStatus("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [
    productSlug,
    releaseSourceObjectUrl,
    resetCropStates,
    setCropDirtyState,
    setCropSourceKindState,
    setCropsAppliedState,
  ]);

  const activateCurrentCropSource = useCallback(() => {
    if (!currentCropSourceUrl) {
      return;
    }

    releaseSourceObjectUrl();
    resetCropStates();

    sourceFileRef.current = null;
    sourceFileNameRef.current = `${productSlug ?? "product-image"}-current`;
    sourceImageRef.current = null;
    setSourceUrl(currentCropSourceUrl);
    setSourceReady(false);
    setSourceLoadFailed(false);
    setCropsAppliedState(false);
    setCropDirtyState(false);
    setCropSourceKindState("current");
    setActiveVariant(PRODUCT_IMAGE_VARIANTS.homepagePolaroid.key);
    setSelectedFileName("");
    setCropStatus("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [
    currentCropSourceUrl,
    productSlug,
    releaseSourceObjectUrl,
    resetCropStates,
    setCropDirtyState,
    setCropSourceKindState,
    setCropsAppliedState,
  ]);

  const clearSelectedImage = useCallback(() => {
    if (currentCropSourceUrl) {
      activateCurrentCropSource();
      return;
    }

    clearCropSource();
  }, [activateCurrentCropSource, clearCropSource, currentCropSourceUrl]);

  useEffect(() => {
    return () => {
      releaseSourceObjectUrl();
      revokeCropPreviewUrls(cropStatesRef.current);
    };
  }, [releaseSourceObjectUrl]);

  useEffect(() => {
    if (currentCropSourceUrl) {
      activateCurrentCropSource();
      return;
    }

    if (cropSourceKindRef.current === "current") {
      clearCropSource();
    }
  }, [activateCurrentCropSource, clearCropSource, currentCropSourceUrl]);

  useEffect(() => {
    if (!sourceUrl) {
      return;
    }

    const image = new window.Image();
    let isCurrentImage = true;
    setSourceReady(false);
    setSourceLoadFailed(false);

    image.onload = () => {
      if (!isCurrentImage) {
        return;
      }

      sourceImageRef.current = image;
      setSourceReady(true);
      setSourceLoadFailed(false);
    };

    image.onerror = () => {
      if (!isCurrentImage) {
        return;
      }

      sourceImageRef.current = null;
      setSourceReady(false);
      setSourceLoadFailed(true);
      setCropStatus(
        cropSourceKindRef.current === "current"
          ? "The current image could not be loaded for cropping. Choose a new image."
          : "This image could not be loaded. Choose a different file.",
      );
    };

    image.src = sourceUrl;

    return () => {
      isCurrentImage = false;
    };
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const image = sourceImageRef.current;

    if (!canvas || !image || !sourceReady) {
      return;
    }

    canvas.width = PREVIEW_WIDTH;
    canvas.height = Math.round(PREVIEW_WIDTH / activeVariantConfig.aspectRatio);
    drawCrop(canvas, image, activeVariantConfig, activeCropState);
  }, [activeCropState, activeVariantConfig, sourceReady]);

  useEffect(() => {
    const form = fileInputRef.current?.form;

    if (!form) {
      return;
    }

    function handleSubmit(event: SubmitEvent) {
      if (cropDirtyRef.current && !cropsAppliedRef.current) {
        event.preventDefault();
        setCropStatus("Use the crops before saving this product.");
      }
    }

    function handleFormData(event: Event) {
      if (!cropsAppliedRef.current) {
        return;
      }

      const formData = (event as FormDataEvent).formData;
      const currentCropStates = cropStatesRef.current;
      const primaryFile = currentCropStates[PRIMARY_PRODUCT_IMAGE_VARIANT].file;

      formData.delete("image");

      formData.set(
        "imageVariantCropStates",
        JSON.stringify(
          Object.fromEntries(
            variantOptions.map((variant) => {
              const cropState = currentCropStates[variant.key];
              return [
                variant.key,
                {
                  panX: cropState.panX,
                  panY: cropState.panY,
                  zoom: cropState.zoom,
                },
              ];
            }),
          ),
        ),
      );

      if (cropSourceKindRef.current === "upload" && primaryFile) {
        formData.append("image", primaryFile, primaryFile.name);
      }

      for (const variant of variantOptions) {
        const imageFile = currentCropStates[variant.key].file;

        if (imageFile) {
          formData.append(
            PRODUCT_IMAGE_VARIANT_FIELD_NAMES[variant.key],
            imageFile,
            imageFile.name,
          );
        }
      }
    }

    form.addEventListener("submit", handleSubmit);
    form.addEventListener("formdata", handleFormData);

    return () => {
      form.removeEventListener("submit", handleSubmit);
      form.removeEventListener("formdata", handleFormData);
    };
  }, []);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.currentTarget.files?.[0] ?? null;

    releaseSourceObjectUrl();
    revokeCropPreviewUrls(cropStatesRef.current);
    const nextCropStates = createInitialCropStates();
    cropStatesRef.current = nextCropStates;
    setCropStatesState(nextCropStates);
    sourceImageRef.current = null;
    setSourceReady(false);
    setSourceLoadFailed(false);
    setCropsAppliedState(false);
    setCropDirtyState(false);

    if (!nextFile) {
      clearSelectedImage();
      return;
    }

    const nextSourceUrl = URL.createObjectURL(nextFile);
    sourceFileRef.current = nextFile;
    sourceFileNameRef.current = nextFile.name;
    sourceObjectUrlRef.current = nextSourceUrl;
    setSourceUrl(nextSourceUrl);
    setCropSourceKindState("upload");
    setCropDirtyState(true);
    setSelectedFileName(nextFile.name);
    setActiveVariant(PRODUCT_IMAGE_VARIANTS.homepagePolaroid.key);
    setCropStatus("Adjust each section crop, then use crops before saving.");
  }

  function updateActiveCropState(updater: (cropState: CropState) => CropState) {
    setCropsAppliedState(false);
    setCropDirtyState(true);
    setCropStatus("Use the crops before saving this product.");
    setCropStates((previous) => ({
      ...previous,
      [activeVariant]: updater(previous[activeVariant]),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!sourceReady || !sourceImageRef.current) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const dragState = dragStateRef.current;
    const canvas = previewCanvasRef.current;
    const image = sourceImageRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || !canvas || !image) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const deltaX = (event.clientX - dragState.lastX) * (canvas.width / bounds.width);
    const deltaY = (event.clientY - dragState.lastY) * (canvas.height / bounds.height);
    const metrics = drawCrop(canvas, image, activeVariantConfig, activeCropState);

    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
    event.preventDefault();

    updateActiveCropState((cropState) => ({
      ...cropState,
      panX:
        metrics.maxOffsetX > 0
          ? clamp(cropState.panX + deltaX / metrics.maxOffsetX, -1, 1)
          : cropState.panX,
      panY:
        metrics.maxOffsetY > 0
          ? clamp(cropState.panY + deltaY / metrics.maxOffsetY, -1, 1)
          : cropState.panY,
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resetActiveCrop() {
    updateActiveCropState((cropState) => ({
      ...cropState,
      panX: 0,
      panY: 0,
      zoom: 1,
    }));
  }

  async function applyCrops() {
    const image = sourceImageRef.current;
    const sourceFileName = sourceFileNameRef.current;

    if (!cropSourceKindRef.current || !image || !sourceReady) {
      setCropStatus("Wait for the image to load before using crops.");
      return;
    }

    try {
      const nextCropStates = { ...cropStatesRef.current };

      for (const variant of variantOptions) {
        const currentPreviewUrl = nextCropStates[variant.key].previewUrl;
        const file = await createCroppedFile({
          sourceFileName,
          image,
          variant,
          cropState: nextCropStates[variant.key],
        });
        const previewUrl = URL.createObjectURL(file);

        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }

        nextCropStates[variant.key] = {
          ...nextCropStates[variant.key],
          file,
          previewUrl,
        };
      }

      cropStatesRef.current = nextCropStates;
      setCropStatesState(nextCropStates);
      setCropsAppliedState(true);
      setCropDirtyState(false);
      setCropStatus(
        cropSourceKindRef.current === "current"
          ? "Crops ready. Saving will update storefront image sections without replacing the main image."
          : "Crops ready for upload.",
      );
    } catch (error) {
      setCropStatus(error instanceof Error ? error.message : "The crops could not be created.");
    }
  }

  return (
    <div className={styles.imageField}>
      <div
        className={previewFrameClassName}
        style={
          showCropCanvas
            ? {
                aspectRatio: `${activeVariantConfig.outputWidth} / ${activeVariantConfig.outputHeight}`,
              }
            : undefined
        }
      >
        {showCropCanvas ? (
          <>
            <canvas
              ref={previewCanvasRef}
              className={styles.cropCanvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label={`${activeVariantConfig.label} crop preview`}
            />
            {!sourceReady ? (
              <div className={styles.imagePreviewPlaceholder}>
                <span>Loading crop image</span>
              </div>
            ) : null}
          </>
        ) : imageUrl ? (
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

      {showCropControls ? (
        <>
          <div className={styles.cropControls}>
            <label>
              <span>Zoom</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={activeCropState.zoom}
                onChange={(event) => {
                  const nextZoom = Number.parseFloat(event.currentTarget.value);
                  updateActiveCropState((cropState) => ({
                    ...cropState,
                    zoom: clamp(nextZoom, MIN_ZOOM, MAX_ZOOM),
                  }));
                }}
                disabled={!sourceReady}
              />
            </label>
          </div>

          <div className={styles.cropActions}>
            <button type="button" className={styles.secondaryButton} onClick={resetActiveCrop}>
              Reset crop
            </button>
            {cropSourceKind === "upload" ? (
              <button type="button" className={styles.secondaryButton} onClick={clearSelectedImage}>
                Cancel image
              </button>
            ) : null}
            <button
              type="button"
              className={styles.cropApplyButton}
              onClick={applyCrops}
              disabled={!sourceReady}
            >
              Use crops
            </button>
          </div>
        </>
      ) : null}

      <label className={styles.filePicker}>
        <span>{disabled ? "Uploads unavailable" : "Choose a new image"}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleImageChange}
          required={required}
          disabled={disabled}
        />
      </label>

      <p className={styles.helperText}>
        {helperText}
      </p>

      {selectedFileName ? (
        <p className={styles.fileName}>
          Selected: {selectedFileName}
          {cropsApplied ? " - crops ready" : cropDirty ? " - use crops before saving" : ""}
        </p>
      ) : null}

      {showCropControls ? (
        <div className={styles.cropEditor}>
          <div className={styles.cropHeader}>
            <h3>Crop product image</h3>
            <p>
              {cropSourceKind === "current"
                ? "Set storefront crops from the current main image."
                : "Set storefront crops from the selected image."}
            </p>
          </div>

          <div className={styles.cropTabs} role="tablist" aria-label="Image crop sections">
            {variantOptions.map((variant) => (
              <button
                key={variant.key}
                type="button"
                className={`${styles.cropTab} ${
                  activeVariant === variant.key ? styles.cropTabActive : ""
                }`.trim()}
                onClick={() => setActiveVariant(variant.key)}
                role="tab"
                aria-selected={activeVariant === variant.key}
              >
                {variant.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {cropStatus ? (
        <p className={styles.cropStatus} aria-live="polite">
          {cropStatus}
        </p>
      ) : null}
    </div>
  );
}
