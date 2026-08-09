import assert from "node:assert/strict";
import test from "node:test";
import {
  getBreadcrumbJsonLd,
  getProductJsonLd,
  getProductSeoDescription,
  getProductSeoTitle,
  parsePriceAmount,
  serializeJsonLd,
} from "../lib/seo.ts";
import type { ShopProduct } from "../lib/products.ts";

const physicalProduct = {
  slug: "matcha-white-chocolate",
  name: "Matcha White Chocolate",
  price: "£20.50",
  description: "Six handmade matcha white chocolate cookies.",
  seoDescription: null,
  allergens: "Wheat, milk, eggs",
  image: "/Matcha/_DSC6442.jpg",
  imageAlt: "Matcha white chocolate cookies",
  isGiftCard: false,
  featured: false,
} satisfies ShopProduct;

test("product SEO titles add Cookies and box size once", () => {
  assert.equal(
    getProductSeoTitle({ name: "Matcha White Chocolate" }),
    "Matcha White Chocolate Cookies – Box of 6 | Grown Cookies",
  );
  assert.equal(
    getProductSeoTitle({ name: "Chocolate Chip Cookies" }),
    "Chocolate Chip Cookies – Box of 6 | Grown Cookies",
  );
  assert.equal(
    getProductSeoTitle({ name: "Gift Card", isGiftCard: true }),
    "Gift Card | Grown Cookies",
  );
});

test("product SEO descriptions use an override or a product-specific fallback", () => {
  assert.equal(
    getProductSeoDescription({
      name: "Matcha White Chocolate",
      seoDescription: "A custom search description.",
    }),
    "A custom search description.",
  );
  assert.equal(
    getProductSeoDescription({ name: "Matcha White Chocolate" }),
    "Shop six Matcha White Chocolate Cookies, freshly prepared by Grown Cookies. Available for UK delivery or collection in Glasgow.",
  );
});

test("price normalization accepts stored GBP formats", () => {
  assert.equal(parsePriceAmount("£20.50"), "20.50");
  assert.equal(parsePriceAmount("Â£18.50"), "18.50");
  assert.equal(parsePriceAmount("GBP 1,200"), "1200.00");
  assert.equal(parsePriceAmount("price unavailable"), null);
});

test("JSON-LD serialization escapes opening markup", () => {
  const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });

  assert.equal(serialized.includes("<"), false);
  assert.deepEqual(JSON.parse(serialized), { name: "</script><script>alert(1)</script>" });
});

test("breadcrumbs use canonical absolute URLs", () => {
  const breadcrumb = getBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
  ]);
  const items = breadcrumb.itemListElement as Array<{ item: string }>;

  assert.equal(items[0].item, "https://growncookies.co.uk/");
  assert.equal(items[1].item, "https://growncookies.co.uk/shop");
});

test("physical product schema includes truthful UK merchant policies", () => {
  const product = getProductJsonLd(physicalProduct, {
    deliveryCostCents: 1000,
    handlingTimeDays: 2,
  });
  const offer = product.offers as Record<string, unknown>;
  const shipping = offer.shippingDetails as Record<string, unknown>;
  const deliveryTime = shipping.deliveryTime as Record<string, unknown>;
  const handlingTime = deliveryTime.handlingTime as Record<string, unknown>;
  const returnPolicy = offer.hasMerchantReturnPolicy as Record<string, unknown>;

  assert.deepEqual(shipping.shippingDestination, {
    "@type": "DefinedRegion",
    addressCountry: "GB",
  });
  assert.deepEqual(shipping.shippingRate, {
    "@type": "MonetaryAmount",
    value: "10.00",
    currency: "GBP",
  });
  assert.equal(handlingTime.minValue, 2);
  assert.equal(handlingTime.maxValue, 2);
  assert.equal(returnPolicy.applicableCountry, "GB");
  assert.equal(
    returnPolicy.returnPolicyCategory,
    "https://schema.org/MerchantReturnNotPermitted",
  );
});

test("digital gift-card schema omits physical shipping and food return policies", () => {
  const product = getProductJsonLd(
    {
      ...physicalProduct,
      slug: "gift-card",
      name: "Gift Card",
      isGiftCard: true,
    },
    { deliveryCostCents: 1000, handlingTimeDays: 2 },
  );
  const offer = product.offers as Record<string, unknown>;

  assert.equal(offer.shippingDetails, undefined);
  assert.equal(offer.hasMerchantReturnPolicy, undefined);
});
