import {
  BAKERY_COLLECTION_METHOD,
  UK_POSTAL_SHIPPING_METHOD,
  parseDispatchSelection,
  type DispatchSelection,
} from "@/lib/dispatch";

const DISPATCH_STORAGE_KEY = "grown-cookies-dispatch-selection";
export const DISPATCH_UPDATED_EVENT = "grown-cookies:dispatch-updated";

function readDispatchRaw() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(DISPATCH_STORAGE_KEY) ?? "";
}

function writeDispatchRaw(value: DispatchSelection | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(DISPATCH_STORAGE_KEY);
  }

  window.dispatchEvent(new Event(DISPATCH_UPDATED_EVENT));
}

export function getDispatchSelection() {
  const rawValue = readDispatchRaw();
  if (!rawValue) {
    return null;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    writeDispatchRaw(null);
    return null;
  }

  const selection = parseDispatchSelection(parsedValue);
  if (!selection) {
    writeDispatchRaw(null);
  }

  return selection;
}

export function setFulfilmentSelection(method: DispatchSelection["method"], scheduledDate: string) {
  writeDispatchRaw({
    method,
    scheduledDate,
  });
}

export function setFulfilmentMethod(method: DispatchSelection["method"]) {
  const current = getDispatchSelection();
  setFulfilmentSelection(method, current?.scheduledDate ?? "");
}

export function setDispatchDate(scheduledDate: string) {
  setFulfilmentSelection(getDispatchSelection()?.method ?? UK_POSTAL_SHIPPING_METHOD, scheduledDate);
}

export function setCollectionDate(scheduledDate: string) {
  setFulfilmentSelection(BAKERY_COLLECTION_METHOD, scheduledDate);
}

export function clearDispatchSelection() {
  writeDispatchRaw(null);
}
