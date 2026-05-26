import type { MetadataRoute } from "next";
import { buildSiteUrl, getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: buildSiteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
