export const UK_POSTAL_SHIPPING_METHOD = "uk_postal_shipping" as const;
export const UK_POSTAL_SHIPPING_LABEL = "UK Postal Shipping";
export const BAKERY_COLLECTION_METHOD = "bakery_collection" as const;
export const BAKERY_COLLECTION_LABEL = "Collection from Akara Bakery";

export type DispatchMethod =
  | typeof UK_POSTAL_SHIPPING_METHOD
  | typeof BAKERY_COLLECTION_METHOD;

export type FulfilmentSelection = {
  method: DispatchMethod;
  scheduledDate: string;
};

export type DispatchSelection = FulfilmentSelection;

export type DispatchSettings = {
  enabledWeekdays: number[];
  sameDayEnabled: boolean;
  cutoffTime: string;
  minimumPrepDays: number;
  bookingHorizonDays: number;
  isDefault?: boolean;
  updatedAt?: string;
};

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  enabledWeekdays: [1, 2, 3, 4, 5],
  sameDayEnabled: false,
  cutoffTime: "12:00",
  minimumPrepDays: 0,
  bookingHorizonDays: 30,
  isDefault: true,
};

const MIN_HORIZON_DAYS = 1;
const MAX_HORIZON_DAYS = 180;
const MIN_PREP_DAYS = 0;
const MAX_PREP_DAYS = 30;
const ALL_WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

function normalizeInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = normalizeInteger(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isIsoDate(value: unknown) {
  const normalized = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }

  const parsed = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized;
}

export function parseDispatchSelection(raw: unknown): DispatchSelection | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const method = normalizeText((raw as { method?: unknown }).method);
  const scheduledDate = normalizeText(
    (raw as { scheduledDate?: unknown }).scheduledDate ??
      (raw as { dispatchDate?: unknown }).dispatchDate,
  );

  if (
    (method !== UK_POSTAL_SHIPPING_METHOD && method !== BAKERY_COLLECTION_METHOD) ||
    (scheduledDate && !isIsoDate(scheduledDate))
  ) {
    return null;
  }

  return {
    method,
    scheduledDate,
  };
}

export function normalizeDispatchSettings(input: Partial<DispatchSettings> = {}): DispatchSettings {
  const enabledWeekdays = Array.from(
    new Set(
      (Array.isArray(input.enabledWeekdays)
        ? input.enabledWeekdays
        : DEFAULT_DISPATCH_SETTINGS.enabledWeekdays
      )
        .map((day) => normalizeInteger(day, -1))
        .filter((day) => ALL_WEEKDAYS.has(day)),
    ),
  ).sort((a, b) => a - b);

  const cutoffTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizeText(input.cutoffTime))
    ? normalizeText(input.cutoffTime)
    : DEFAULT_DISPATCH_SETTINGS.cutoffTime;

  return {
    enabledWeekdays: enabledWeekdays.length > 0 ? enabledWeekdays : DEFAULT_DISPATCH_SETTINGS.enabledWeekdays,
    sameDayEnabled: input.sameDayEnabled === true,
    cutoffTime,
    minimumPrepDays: clampInteger(
      input.minimumPrepDays,
      DEFAULT_DISPATCH_SETTINGS.minimumPrepDays,
      MIN_PREP_DAYS,
      MAX_PREP_DAYS,
    ),
    bookingHorizonDays: clampInteger(
      input.bookingHorizonDays,
      DEFAULT_DISPATCH_SETTINGS.bookingHorizonDays,
      MIN_HORIZON_DAYS,
      MAX_HORIZON_DAYS,
    ),
    isDefault: input.isDefault,
    updatedAt: normalizeText(input.updatedAt) || undefined,
  };
}

function getLondonDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: Number.parseInt(getPart("hour"), 10) || 0,
    minute: Number.parseInt(getPart("minute"), 10) || 0,
  };
}

export function getLondonTodayIso(now = new Date()) {
  const parts = getLondonDateParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDaysToIsoDate(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getIsoDateWeekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function getTimeMinutes(time: string) {
  const [hours, minutes] = time.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function isSameDayAvailable(settings: DispatchSettings, now: Date) {
  if (!settings.sameDayEnabled) {
    return false;
  }

  const parts = getLondonDateParts(now);
  const currentMinutes = parts.hour * 60 + parts.minute;
  return currentMinutes <= getTimeMinutes(settings.cutoffTime);
}

export function getAvailableDispatchDates(
  rawSettings: DispatchSettings,
  options: { now?: Date; limit?: number } = {},
) {
  const settings = normalizeDispatchSettings(rawSettings);
  const now = options.now ?? new Date();
  const today = getLondonTodayIso(now);
  let firstOffset = Math.max(0, settings.minimumPrepDays);

  if (firstOffset === 0 && !isSameDayAvailable(settings, now)) {
    firstOffset = 1;
  }

  const firstDate = addDaysToIsoDate(today, firstOffset);
  const lastDate = addDaysToIsoDate(today, settings.bookingHorizonDays);
  const enabledWeekdays = new Set(settings.enabledWeekdays);
  const availableDates: string[] = [];

  for (let date = firstDate; date <= lastDate; date = addDaysToIsoDate(date, 1)) {
    if (enabledWeekdays.has(getIsoDateWeekday(date))) {
      availableDates.push(date);
      if (options.limit && availableDates.length >= options.limit) {
        break;
      }
    }
  }

  return availableDates;
}

export function isDispatchDateAvailable(
  date: string,
  settings: DispatchSettings,
  options: { now?: Date } = {},
) {
  if (!isIsoDate(date)) {
    return false;
  }

  return getAvailableDispatchDates(settings, options).includes(date);
}

export function validateDispatchSelection(
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

  if (
    selection.method !== UK_POSTAL_SHIPPING_METHOD &&
    selection.method !== BAKERY_COLLECTION_METHOD
  ) {
    throw new Error("Choose a valid fulfilment method.");
  }

  if (!isDispatchDateAvailable(selection.scheduledDate, settings, { now: options.now })) {
    throw new Error("That date is no longer available. Choose a new date.");
  }

  return selection;
}

export function formatDispatchDate(date: string) {
  if (!isIsoDate(date)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatDispatchMethod(method: unknown) {
  if (method === UK_POSTAL_SHIPPING_METHOD) {
    return UK_POSTAL_SHIPPING_LABEL;
  }

  return method === BAKERY_COLLECTION_METHOD ? BAKERY_COLLECTION_LABEL : "";
}
