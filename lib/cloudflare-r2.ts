import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

function getExplicitR2Credentials(): R2Credentials | null {
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return { accessKeyId, secretAccessKey };
}

function getR2Endpoint() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const jurisdiction = process.env.CLOUDFLARE_R2_JURISDICTION?.trim().toLowerCase();

  if (!accountId) {
    return null;
  }

  if (jurisdiction === "eu") {
    return `https://${accountId}.eu.r2.cloudflarestorage.com`;
  }

  if (jurisdiction === "fedramp") {
    return `https://${accountId}.fedramp.r2.cloudflarestorage.com`;
  }

  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function hasCloudflareR2UploadConfig() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_BUCKET_NAME &&
      getExplicitR2Credentials(),
  );
}

async function getR2Client() {
  const credentials = getExplicitR2Credentials();
  const endpoint = getR2Endpoint();

  if (!credentials || !endpoint) {
    throw new Error(
      "Cloudflare R2 upload credentials are not configured. Set CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials,
  });
}

function sanitizeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "product-image";
}

function getFileExtension(file: File) {
  const normalizedName = sanitizeFileName(file.name || "product-image");
  const existingExtension = normalizedName.match(/\.[a-z0-9]+$/i)?.[0];

  if (existingExtension) {
    return { fileName: normalizedName, extension: existingExtension };
  }

  const extension = MIME_EXTENSIONS[file.type] ?? ".jpg";
  return {
    fileName: `${normalizedName}${extension}`,
    extension,
  };
}

export async function uploadProductImageToR2(slug: string, file: File) {
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Cloudflare R2 bucket is not configured.");
  }

  if (!file.size) {
    throw new Error("Select an image to upload.");
  }

  const client = await getR2Client();
  const { fileName } = getFileExtension(file);
  const safeSlug = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-");
  const key = `products/${safeSlug}/${Date.now()}-${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { key };
}

export async function deleteProductImageFromR2(key: string) {
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Cloudflare R2 bucket is not configured.");
  }

  const normalizedKey = key.trim();

  if (!normalizedKey) {
    return;
  }

  const client = await getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: normalizedKey,
    }),
  );
}
