import { normalizeDispatchSettings, type DispatchSettings } from "./dispatch.ts";

type DeliveryPolicySection = {
  title: string;
  paragraphs: string[];
  bulletPoints: string[];
  closingParagraphs: string[];
};

const WEEKDAY_LABELS = new Map<number, string>([
  [0, "Sunday"],
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
]);
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const weekdayListFormatter = new Intl.ListFormat("en-GB", {
  style: "long",
  type: "conjunction",
});

function formatDeliveryCost(deliveryCostCents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(deliveryCostCents / 100);
}

function formatDispatchDays(enabledWeekdays: number[]) {
  const enabledSet = new Set(enabledWeekdays);
  const labels = WEEKDAY_DISPLAY_ORDER.map((weekday) =>
    enabledSet.has(weekday) ? WEEKDAY_LABELS.get(weekday) ?? "" : "",
  ).filter(Boolean);

  return weekdayListFormatter.format(labels);
}

function formatCutoffTime(cutoffTime: string) {
  const [hoursText, minutesText] = cutoffTime.split(":");
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return cutoffTime;
  }

  const suffix = hours >= 12 ? "pm" : "am";
  const displayHour = hours % 12 || 12;

  return minutes === 0
    ? `${displayHour}${suffix}`
    : `${displayHour}:${String(minutes).padStart(2, "0")}${suffix}`;
}

function getDispatchNotice(settings: DispatchSettings) {
  if (settings.sameDayEnabled && settings.minimumPrepDays === 0) {
    return `Orders placed before ${formatCutoffTime(settings.cutoffTime)} can be dispatched the same working day`;
  }

  const minimumNoticeDays = settings.minimumPrepDays > 0 ? settings.minimumPrepDays : 1;
  return minimumNoticeDays === 1
    ? "Orders require at least 1 day's notice before dispatch"
    : `Orders require at least ${minimumNoticeDays} days' notice before dispatch`;
}

export function buildDeliveryPolicySection({
  deliveryCostCents,
  dispatchSettings,
}: {
  deliveryCostCents: number;
  dispatchSettings: DispatchSettings;
}): DeliveryPolicySection {
  const normalizedDispatchSettings = normalizeDispatchSettings(dispatchSettings);

  return {
    title: "Delivery Policy",
    paragraphs: ["We ship selected products across the UK using Royal Mail 24-hour tracked service."],
    bulletPoints: [
      `${formatDeliveryCost(deliveryCostCents)} flat rate`,
      `Dispatch days: ${formatDispatchDays(normalizedDispatchSettings.enabledWeekdays)}`,
      getDispatchNotice(normalizedDispatchSettings),
      "Delivery typically arrives within 1 working day after dispatch",
      "Bank holidays in England, Wales, and Scotland are unavailable for dispatch",
    ],
    closingParagraphs: [
      "You can select your preferred dispatch date at checkout.",
      "Please note: While this is a tracked 24-hour service, delays can occasionally occur",
    ],
  };
}
