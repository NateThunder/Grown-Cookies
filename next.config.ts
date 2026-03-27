import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

function getRemotePatterns(): RemotePattern[] {
  const remotePatterns: RemotePattern[] = [
    {
      protocol: "https",
      hostname: "**.r2.dev",
    },
  ];

  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;

  if (!publicBaseUrl) {
    return remotePatterns;
  }

  try {
    const url = new URL(publicBaseUrl);
    const protocol = url.protocol.replace(/:$/, "");

    if (protocol !== "http" && protocol !== "https") {
      return remotePatterns;
    }

    const pathname = url.pathname.replace(/\/+$/, "");

    remotePatterns.push({
      protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: pathname ? `${pathname}/**` : "/**",
    });
  } catch {
    console.warn(
      "Invalid CLOUDFLARE_R2_PUBLIC_BASE_URL; skipping custom remote image host.",
    );
  }

  return remotePatterns;
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: getRemotePatterns(),
  },
};

export default nextConfig;