import { isIsoDate } from "./dispatch.ts";

const GOV_UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";
const DISPATCH_BANK_HOLIDAY_REGIONS = ["england-and-wales", "scotland"] as const;
const DEFAULT_FALLBACK_YEARS = [2026, 2027] as const;

// Keep the next operational year covered if GOV.UK is temporarily unavailable.
const FALLBACK_DISPATCH_BANK_HOLIDAYS_BY_YEAR: Record<number, readonly string[]> = {
  2026: [
    "2026-01-01",
    "2026-01-02",
    "2026-04-03",
    "2026-04-06",
    "2026-05-04",
    "2026-05-25",
    "2026-06-15",
    "2026-08-03",
    "2026-08-31",
    "2026-11-30",
    "2026-12-25",
    "2026-12-28",
  ],
  2027: [
    "2027-01-01",
    "2027-01-04",
    "2027-03-26",
    "2027-03-29",
    "2027-05-03",
    "2027-05-31",
    "2027-08-02",
    "2027-08-30",
    "2027-11-30",
    "2027-12-27",
    "2027-12-28",
  ],
};

type GovUkBankHolidayRegion = {
  events?: Array<{
    date?: unknown;
  }>;
};

type GovUkBankHolidayResponse = Partial<
  Record<(typeof DISPATCH_BANK_HOLIDAY_REGIONS)[number] | string, GovUkBankHolidayRegion>
>;

function normalizeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeYears(years: readonly number[] = DEFAULT_FALLBACK_YEARS) {
  return Array.from(
    new Set(
      years
        .map((year) => normalizeInteger(year))
        .filter((year) => Number.isInteger(year) && year > 0),
    ),
  ).sort((left, right) => left - right);
}

function getDateYear(date: string) {
  return normalizeInteger(date.slice(0, 4));
}

export function filterDispatchBankHolidayDatesByYears(
  dates: readonly string[],
  years: readonly number[],
) {
  if (years.length === 0) {
    return [...dates];
  }

  const yearSet = new Set(years);
  return dates.filter((date) => yearSet.has(getDateYear(date)));
}

export function excludeDispatchBankHolidays(
  availableDates: readonly string[],
  bankHolidayDates: Iterable<string>,
) {
  const blockedDates = bankHolidayDates instanceof Set ? bankHolidayDates : new Set(bankHolidayDates);
  return availableDates.filter((date) => !blockedDates.has(date));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getFallbackDispatchBankHolidayDates(years: readonly number[] = DEFAULT_FALLBACK_YEARS) {
  return Array.from(
    new Set(
      normalizeYears(years).flatMap((year) => FALLBACK_DISPATCH_BANK_HOLIDAYS_BY_YEAR[year] ?? []),
    ),
  ).sort();
}

export function normalizeGovUkDispatchBankHolidayDates(
  payload: unknown,
  options: { years?: readonly number[] } = {},
) {
  if (!payload || typeof payload !== "object") {
    throw new Error("GOV.UK bank holidays payload is invalid.");
  }

  const years = normalizeYears(options.years);
  const dates = new Set<string>();
  const bankHolidays = payload as GovUkBankHolidayResponse;

  for (const region of DISPATCH_BANK_HOLIDAY_REGIONS) {
    const events = bankHolidays[region]?.events;
    if (!Array.isArray(events)) {
      continue;
    }

    for (const event of events) {
      const date = typeof event?.date === "string" ? event.date.trim() : "";
      if (!isIsoDate(date)) {
        continue;
      }

      if (years.length > 0 && !years.includes(getDateYear(date))) {
        continue;
      }

      dates.add(date);
    }
  }

  return Array.from(dates).sort();
}

export async function fetchDispatchBankHolidayDates(
  options: {
    years?: readonly number[];
    fetchImpl?: typeof fetch;
  } = {},
) {
  const years = normalizeYears(options.years);
  const fallbackDates = getFallbackDispatchBankHolidayDates(
    years.length > 0 ? years : DEFAULT_FALLBACK_YEARS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(GOV_UK_BANK_HOLIDAYS_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`GOV.UK bank holidays request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as unknown;
    const dates = normalizeGovUkDispatchBankHolidayDates(
      payload,
      years.length > 0 ? { years } : {},
    );

    if (dates.length === 0) {
      throw new Error("GOV.UK bank holidays response did not include dispatch dates.");
    }

    return dates;
  } catch (error) {
    console.error("Could not load GOV.UK bank holiday data for dispatch exclusions.", {
      error: getErrorMessage(error),
    });
    return fallbackDates;
  }
}

export function getDispatchBankHolidayYearsFromDateRange(options: { from?: string; to?: string }) {
  const fromDate = typeof options.from === "string" ? options.from : "";
  const toDate = typeof options.to === "string" ? options.to : "";
  const startYear = isIsoDate(fromDate) ? getDateYear(fromDate) : NaN;
  const endYear = isIsoDate(toDate) ? getDateYear(toDate) : NaN;

  if (!Number.isFinite(startYear) && !Number.isFinite(endYear)) {
    return [] as number[];
  }

  const rangeStart = Number.isFinite(startYear) ? startYear : endYear;
  const rangeEnd = Number.isFinite(endYear) ? endYear : startYear;
  const firstYear = Math.min(rangeStart, rangeEnd);
  const lastYear = Math.max(rangeStart, rangeEnd);
  const years: number[] = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    years.push(year);
  }

  return years;
}
