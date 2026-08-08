import { unstable_cache } from "next/cache";
import {
  BAKERY_COLLECTION_METHOD,
  UK_POSTAL_SHIPPING_METHOD,
  getAvailableDispatchDates,
  isIsoDate,
  type DispatchSelection,
  type DispatchSettings,
} from "./dispatch.ts";
import {
  excludeDispatchBankHolidays,
  fetchDispatchBankHolidayDates,
  filterDispatchBankHolidayDatesByYears,
  getDispatchBankHolidayYearsFromDateRange,
} from "./bank-holidays.ts";

const DISPATCH_BANK_HOLIDAYS_CACHE_SECONDS = 60 * 60 * 24;

const getCachedDispatchBankHolidayDates = unstable_cache(
  async () => fetchDispatchBankHolidayDates(),
  ["dispatch-bank-holidays"],
  {
    revalidate: DISPATCH_BANK_HOLIDAYS_CACHE_SECONDS,
  },
);

async function getDispatchBankHolidayDateSet(options: { from?: string; to?: string } = {}) {
  const years = getDispatchBankHolidayYearsFromDateRange(options);
  const dates = await getCachedDispatchBankHolidayDates();
  return new Set(filterDispatchBankHolidayDatesByYears(dates, years));
}

export async function getAvailableDispatchDatesWithHolidayExclusions(
  rawSettings: DispatchSettings,
  options: { now?: Date; limit?: number } = {},
) {
  const availableDates = getAvailableDispatchDates(rawSettings, { now: options.now });

  if (availableDates.length === 0) {
    return [];
  }

  const bankHolidayDates = await getDispatchBankHolidayDateSet({
    from: availableDates[0],
    to: availableDates.at(-1),
  });
  const filteredDates = excludeDispatchBankHolidays(availableDates, bankHolidayDates);

  return typeof options.limit === "number" ? filteredDates.slice(0, options.limit) : filteredDates;
}

export async function isDispatchDateAvailableWithHolidayExclusions(
  date: string,
  settings: DispatchSettings,
  options: { now?: Date } = {},
) {
  if (!isIsoDate(date)) {
    return false;
  }

  const availableDates = await getAvailableDispatchDatesWithHolidayExclusions(settings, {
    now: options.now,
  });

  return availableDates.includes(date);
}

export async function validateDispatchSelectionWithHolidayExclusions(
  selection: DispatchSelection | null,
  settings: DispatchSettings,
  options: { required?: boolean; now?: Date } = {},
) {
  if (!options.required && !selection) {
    return null;
  }

  if (!selection) {
    throw new Error("Choose a dispatch date before checkout.");
  }

  if (selection.method !== UK_POSTAL_SHIPPING_METHOD && selection.method !== BAKERY_COLLECTION_METHOD) {
    throw new Error("Choose a valid fulfilment method.");
  }

  if (
    !(await isDispatchDateAvailableWithHolidayExclusions(selection.scheduledDate, settings, {
      now: options.now,
    }))
  ) {
    throw new Error("That date is no longer available. Choose a new date.");
  }

  return selection;
}

export { excludeDispatchBankHolidays };
