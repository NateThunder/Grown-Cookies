import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/products";
import { buildSiteUrl } from "@/lib/site-url";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: buildSiteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: buildSiteUrl("/shop"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: buildSiteUrl("/cookie-gift-boxes"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildSiteUrl("/cookies-glasgow"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildSiteUrl("/contact"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: buildSiteUrl("/faqs"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: buildSiteUrl("/delivery"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: buildSiteUrl("/privacy"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: buildSiteUrl("/terms"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const productRoutes = products.map((product) => ({
    url: buildSiteUrl(`/shop/${product.slug}`),
    changeFrequency: "weekly" as const,
    priority: product.featured ? 0.8 : 0.7,
  }));

  return [...staticRoutes, ...productRoutes];
}
