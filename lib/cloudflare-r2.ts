import { createHash } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type CloudflareTokenVerificationResponse = {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: {
    id?: string;
    status?: string;
  };
};

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

let derivedCredentialsPromise: Promise<R2Credentials | null> | null = null;

function getExplicitR2Credentials() {
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return { accessKeyId, secretAccessKey };
}

async function getDerivedR2Credentials() {
  if (derivedCredentialsPromise) {
    return derivedCredentialsPromise;
  }

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    return null;
  }

  derivedCredentialsPromise = (async () => {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/user/tokens/verify",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `Cloudflare token verification failed with ${response.status}.`,
      );
    }

    const payload =
      (await response.json()) as CloudflareTokenVerificationResponse;

    if (!payload.success || !payload.result?.id) {
      const message =
        payload.errors?.map((error) => error.message).filter(Boolean).join(", ") ||
        "Cloudflare token verification failed.";
      throw new Error(message);
    }

    return {
      accessKeyId: payload.result.id,
      secretAccessKey: createHash("sha256").update(apiToken).digest("hex"),
    };
  })();

  try {
    return await derivedCredentialsPromise;
  } catch (error) {
    derivedCredentialsPromise = null;
    throw error;
  }
}

async function getR2Credentials() {
  return getExplicitR2Credentials() ?? getDerivedR2Credentials();
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
      (getExplicitR2Credentials() || process.env.CLOUDFLARE_API_TOKEN),
  );
}

async function getR2Client() {
  const credentials = await getR2Credentials();
  const endpoint = getR2Endpoint();

  if (!credentials || !endpoint) {
    throw new Error("Cloudflare R2 upload credentials are not configured.");
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