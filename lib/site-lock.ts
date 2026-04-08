import { getSiteLockSetting } from "@/lib/store-settings";

const SITE_LOCK_DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

function getDefaultSiteLockEnabled() {
  const rawValue = process.env.SITE_LOCK_ENABLED?.trim().toLowerCase();

  if (!rawValue) {
    return true;
  }

  return !SITE_LOCK_DISABLED_VALUES.has(rawValue);
}

export async function isSiteLockEnabled() {
  const setting = await getSiteLockSetting(getDefaultSiteLockEnabled());
  return setting.enabled;
}

export async function getSiteLockAdminState() {
  return getSiteLockSetting(getDefaultSiteLockEnabled());
}
