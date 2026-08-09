import type { ShopProduct } from "@/lib/products";
import { MIN_GIFT_CARD_AMOUNT_CENTS } from "@/lib/gift-card-amounts";
import { buildSiteUrl } from "@/lib/site-url";

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

export type JsonLdObject = { [key: string]: JsonLdValue | undefined };

const ORGANIZATION_ID = buildSiteUrl("/#organization");

export type ProductMerchantDetails = {
  deliveryCostCents: number;
  handlingTimeDays: number;
};

export function serializeJsonLd(value: JsonLdObject | JsonLdObject[]) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function parsePriceAmount(price: string) {
  const normalized = price.replace(/Â£|£|GBP/gi, "").replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

export function getCookieProductName(name: string) {
  return /\bcookies?\b/i.test(name) ? name : `${name} Cookies`;
}

export function getProductSeoTitle(product: Pick<ShopProduct, "name" | "isGiftCard">) {
  return product.isGiftCard
    ? `${product.name} | Grown Cookies`
    : `${getCookieProductName(product.name)} – Box of 6 | Grown Cookies`;
}

export function getProductSeoDescription(
  product: Pick<ShopProduct, "name" | "isGiftCard" | "seoDescription">,
) {
  const override = product.seoDescription?.trim();

  if (override) {
    return override;
  }

  return product.isGiftCard
    ? `Give a Grown Cookies ${product.name} and let them choose their favourite flavours. A thoughtful digital gift for birthdays and celebrations.`
    : `Shop six ${getCookieProductName(product.name)}, freshly prepared by Grown Cookies. Available for UK delivery or collection in Glasgow.`;
}

export function getOrganizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Grown Cookies",
    url: buildSiteUrl("/"),
    logo: buildSiteUrl("/growncookies-1024-transparent-cropped.PNG"),
    email: "orders@growncookies.co.uk",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Office 85, 13 Fitzroy Place, 1/1 Sauchiehall Street",
      addressLocality: "Glasgow",
      postalCode: "G3 7RH",
      addressCountry: "GB",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "orders@growncookies.co.uk",
      areaServed: "GB",
      availableLanguage: "en",
    },
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
    sameAs: ["https://www.instagram.com/growncookiesuk"],
  };
}

export function getBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildSiteUrl(item.path),
    })),
  };
}

function getAbsoluteImageUrl(image?: string) {
  if (!image) {
    return undefined;
  }

  try {
    return new URL(image, buildSiteUrl("/")).toString();
  } catch {
    return undefined;
  }
}

export function getProductJsonLd(
  product: ShopProduct,
  merchantDetails?: ProductMerchantDetails,
): JsonLdObject {
  const price = product.isGiftCard
    ? (MIN_GIFT_CARD_AMOUNT_CENTS / 100).toFixed(2)
    : parsePriceAmount(product.price);
  const url = buildSiteUrl(`/shop/${product.slug}`);
  const image = getAbsoluteImageUrl(product.imageVariants?.product_detail ?? product.image);
  const shippingRate = merchantDetails
    ? (merchantDetails.deliveryCostCents / 100).toFixed(2)
    : null;
  const handlingTimeDays = merchantDetails
    ? Math.max(0, Math.round(merchantDetails.handlingTimeDays))
    : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.isGiftCard ? product.name : getCookieProductName(product.name),
    description: product.description,
    image: image ? [image] : undefined,
    category: product.isGiftCard ? "Digital Gift Cards" : "Cookies",
    brand: {
      "@type": "Brand",
      name: "Grown Cookies",
    },
    offers: price
      ? {
          "@type": "Offer",
          url,
          priceCurrency: "GBP",
          price,
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": ORGANIZATION_ID },
          shippingDetails:
            !product.isGiftCard && shippingRate !== null && handlingTimeDays !== null
              ? {
                  "@type": "OfferShippingDetails",
                  shippingDestination: {
                    "@type": "DefinedRegion",
                    addressCountry: "GB",
                  },
                  shippingRate: {
                    "@type": "MonetaryAmount",
                    value: shippingRate,
                    currency: "GBP",
                  },
                  deliveryTime: {
                    "@type": "ShippingDeliveryTime",
                    handlingTime: {
                      "@type": "QuantitativeValue",
                      minValue: handlingTimeDays,
                      maxValue: handlingTimeDays,
                      unitCode: "DAY",
                    },
                    transitTime: {
                      "@type": "QuantitativeValue",
                      minValue: 1,
                      maxValue: 1,
                      unitCode: "DAY",
                    },
                  },
                }
              : undefined,
          hasMerchantReturnPolicy: !product.isGiftCard
            ? {
                "@type": "MerchantReturnPolicy",
                applicableCountry: "GB",
                returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
              }
            : undefined,
        }
      : undefined,
  };
}

export function getItemListJsonLd(
  products: ShopProduct[],
  { name, path }: { name: string; path: string },
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: buildSiteUrl(path),
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: buildSiteUrl(`/shop/${product.slug}`),
      name: product.isGiftCard ? product.name : getCookieProductName(product.name),
    })),
  };
}

export function getFaqJsonLd(
  items: Array<{ question: string; answer: string }>,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
