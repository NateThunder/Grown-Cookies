import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

type NominatimResult = {
  display_name?: string;
  address?: NominatimAddress;
};

type AddressSuggestion = {
  label: string;
  secondaryLabel: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
};

const SUPPORTED_COUNTRY_CODES: Record<string, string> = {
  "United Kingdom": "gb",
  "United States": "us",
  Canada: "ca",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildAddressLine1(address?: NominatimAddress) {
  if (!address) {
    return "";
  }

  const street = normalizeText(address.road || address.pedestrian || address.footway);
  const houseNumber = normalizeText(address.house_number);
  const fallback = normalizeText(address.neighbourhood || address.suburb);

  return [houseNumber, street].filter(Boolean).join(" ") || fallback;
}

function buildCity(address?: NominatimAddress) {
  if (!address) {
    return "";
  }

  return normalizeText(address.city || address.town || address.village || address.hamlet || address.county);
}

function buildSecondaryLabel(city: string, postcode: string, country: string) {
  return [city, postcode, country].filter(Boolean).join(", ");
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function countSharedTokens(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  if (leftTokens.size === 0) {
    return 0;
  }

  return tokenize(right).reduce((count, token) => count + (leftTokens.has(token) ? 1 : 0), 0);
}

function getLeadingHouseNumber(value: string) {
  const match = normalizeText(value).match(/^(\d+[a-z]?)/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function scoreSuggestion(query: string, suggestion: AddressSuggestion) {
  const normalizedQuery = normalizeText(query).toLowerCase();
  const normalizedAddress = suggestion.addressLine1.toLowerCase();
  const normalizedSecondary = suggestion.secondaryLabel.toLowerCase();
  const queryHouseNumber = getLeadingHouseNumber(query);
  const addressHouseNumber = getLeadingHouseNumber(suggestion.addressLine1);
  let score = 0;

  if (queryHouseNumber && queryHouseNumber === addressHouseNumber) {
    score += 6;
  }

  if (normalizedAddress === normalizedQuery) {
    score += 8;
  } else if (normalizedAddress.startsWith(normalizedQuery)) {
    score += 5;
  } else if (normalizedAddress.includes(normalizedQuery)) {
    score += 3;
  }

  score += countSharedTokens(query, suggestion.addressLine1) * 2;
  score += countSharedTokens(query, suggestion.secondaryLabel);

  if (normalizedSecondary.includes(normalizedQuery)) {
    score += 1;
  }

  return score;
}

function mapResult(result: NominatimResult): AddressSuggestion | null {
  const addressLine1 = buildAddressLine1(result.address);
  const city = buildCity(result.address);
  const postcode = normalizeText(result.address?.postcode);
  const country = normalizeText(result.address?.country);
  const secondaryLabel = buildSecondaryLabel(city, postcode, country);
  const label = addressLine1;

  if (!addressLine1 || !city || !postcode || !country || !label || !secondaryLabel) {
    return null;
  }

  return {
    label,
    secondaryLabel,
    addressLine1,
    city,
    postcode,
    country,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeText(searchParams.get("q"));
  const country = normalizeText(searchParams.get("country"));
  const postcode = normalizeText(searchParams.get("postcode"));

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const nominatimParams = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  });

  const countryCode = SUPPORTED_COUNTRY_CODES[country];
  if (countryCode) {
    nominatimParams.set("countrycodes", countryCode);
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
        "User-Agent": "grown-cookies-checkout/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 502 });
    }

    const data = (await response.json()) as NominatimResult[];
    const seen = new Set<string>();
    const suggestions = data
      .map(mapResult)
      .filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion))
      .filter((suggestion) => {
        if (!postcode) {
          return true;
        }

        return suggestion.postcode.toLowerCase() === postcode.toLowerCase();
      })
      .filter((suggestion) => {
        const key = `${suggestion.addressLine1}|${suggestion.city}|${suggestion.postcode}|${suggestion.country}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((left, right) => scoreSuggestion(query, right) - scoreSuggestion(query, left));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
