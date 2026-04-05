import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

void initOpenNextCloudflareForDev();

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

function getOrigin(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

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

function getContentSecurityPolicy() {
  const connectSrc = new Set([
    "'self'",
    "https://api.stripe.com",
    "https://m.stripe.network",
    "https://q.stripe.com",
    "https://r.stripe.com",
  ]);
  const frameSrc = new Set([
    "'self'",
    "https://billing.stripe.com",
    "https://checkout.stripe.com",
    "https://hooks.stripe.com",
    "https://js.stripe.com",
  ]);
  const imgSrc = new Set([
    "'self'",
    "blob:",
    "data:",
    "https:",
  ]);
  const scriptSrc = new Set([
    "'self'",
    "'unsafe-inline'",
    "https://js.stripe.com",
  ]);

  if (process.env.NODE_ENV !== "production") {
    scriptSrc.add("'unsafe-eval'");
  }

  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publicR2Origin = getOrigin(process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL);

  if (supabaseOrigin) {
    connectSrc.add(supabaseOrigin);
  }

  if (publicR2Origin) {
    connectSrc.add(publicR2Origin);
    imgSrc.add(publicR2Origin);
  }

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["font-src", ["'self'", "data:"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["frame-src", [...frameSrc]],
    ["img-src", [...imgSrc]],
    ["manifest-src", ["'self'"]],
    ["media-src", ["'self'", "blob:", "data:"]],
    ["object-src", ["'none'"]],
    ["script-src", [...scriptSrc]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["connect-src", [...connectSrc]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  if (process.env.NODE_ENV === "production") {
    directives.push(["upgrade-insecure-requests", []]);
  }

  return directives
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: getContentSecurityPolicy(),
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: getRemotePatterns(),
  },
};

export default nextConfig;
