import assert from "node:assert/strict";
import test from "node:test";
import {
  excludeDispatchBankHolidays,
  fetchDispatchBankHolidayDates,
  getFallbackDispatchBankHolidayDates,
  normalizeGovUkDispatchBankHolidayDates,
} from "../lib/bank-holidays.ts";
import { DEFAULT_DISPATCH_SETTINGS, getAvailableDispatchDates } from "../lib/dispatch.ts";

test("normalizeGovUkDispatchBankHolidayDates unions England/Wales and Scotland only", () => {
  const dates = normalizeGovUkDispatchBankHolidayDates(
    {
      "england-and-wales": {
        events: [{ date: "2026-04-03" }, { date: "2026-12-28" }],
      },
      scotland: {
        events: [{ date: "2026-04-03" }, { date: "2026-11-30" }],
      },
      "northern-ireland": {
        events: [{ date: "2026-03-17" }],
      },
    },
    { years: [2026] },
  );

  assert.deepEqual(dates, ["2026-04-03", "2026-11-30", "2026-12-28"]);
});

test("excludeDispatchBankHolidays removes bank holidays from otherwise available dispatch dates", () => {
  const availableDates = getAvailableDispatchDates(
    {
      ...DEFAULT_DISPATCH_SETTINGS,
      enabledWeekdays: [1, 2, 3, 4, 5],
      sameDayEnabled: true,
      cutoffTime: "23:59",
      minimumPrepDays: 0,
      bookingHorizonDays: 10,
    },
    { now: new Date("2026-03-31T09:00:00Z") },
  );

  assert.equal(availableDates.includes("2026-04-03"), true);
  assert.equal(availableDates.includes("2026-04-06"), true);

  const filteredDates = excludeDispatchBankHolidays(availableDates, [
    "2026-04-03",
    "2026-04-06",
  ]);

  assert.equal(filteredDates.includes("2026-04-03"), false);
  assert.equal(filteredDates.includes("2026-04-06"), false);
  assert.equal(filteredDates.includes("2026-04-01"), true);
});

test("fetchDispatchBankHolidayDates falls back to checked-in dates when GOV.UK fetch fails", async () => {
  const fallbackDates = getFallbackDispatchBankHolidayDates([2026, 2027]);
  const rejectingFetch: typeof fetch = async () => {
    throw new Error("network unavailable");
  };
  const originalConsoleError = console.error;

  console.error = () => {};

  try {
    const dates = await fetchDispatchBankHolidayDates({
      years: [2026, 2027],
      fetchImpl: rejectingFetch,
    });

    assert.deepEqual(dates, fallbackDates);
  } finally {
    console.error = originalConsoleError;
  }
});
