export type SearchParamValue = string | string[] | undefined;

export type AdminView = "all" | "featured";

export type AdminSidebarSection =
  | "products"
  | "featured"
  | "homepage"
  | "orders"
  | "delivery"
  | "mailing-list"
  | "analytics"
  | "launch";

export type AdminFlashState = {
  notice?: string;
  warning?: string;
  error?: string;
};

type SearchParamReader = {
  get(name: string): string | null;
};

export type AdminNavItem = {
  id: AdminSidebarSection;
  href: string;
  label: string;
  matches: (pathname: string, searchParams: SearchParamReader) => boolean;
};

type AdminPathOptions = AdminFlashState & {
  view?: AdminView;
  productSlug?: string;
  createNew?: boolean;
};

const EMPTY_SEARCH_PARAMS = new URLSearchParams();

function getSearchParamReader(searchParams?: SearchParamReader | string) {
  if (typeof searchParams === "string") {
    return new URLSearchParams(searchParams);
  }

  return searchParams ?? EMPTY_SEARCH_PARAMS;
}

function isFeaturedView(searchParams: SearchParamReader) {
  return searchParams.get("view") === "featured";
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: "products",
    href: "/admin",
    label: "Edit products",
    matches: (pathname, searchParams) => pathname === "/admin" && !isFeaturedView(searchParams),
  },
  {
    id: "featured",
    href: "/admin?view=featured",
    label: "Edit featured products",
    matches: (pathname, searchParams) => pathname === "/admin" && isFeaturedView(searchParams),
  },
  {
    id: "homepage",
    href: "/admin/homepage",
    label: "Cookie of the Month",
    matches: (pathname) => pathname === "/admin/homepage",
  },
  {
    id: "orders",
    href: "/admin/orders",
    label: "Orders",
    matches: (pathname) => pathname === "/admin/orders",
  },
  {
    id: "delivery",
    href: "/admin/delivery",
    label: "Delivery",
    matches: (pathname) => pathname === "/admin/delivery",
  },
  {
    id: "analytics",
    href: "/admin/analytics",
    label: "Analytics",
    matches: (pathname) => pathname === "/admin/analytics",
  },
  {
    id: "mailing-list",
    href: "/admin/mailing-list",
    label: "Mailing list",
    matches: (pathname) => pathname === "/admin/mailing-list",
  },
  {
    id: "launch",
    href: "/admin/launch",
    label: "Launch",
    matches: (pathname) => pathname === "/admin/launch",
  },
];

export function getFirstSearchParamValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function getAdminFlashState(
  params: Record<string, SearchParamValue>,
): AdminFlashState {
  return {
    notice: getFirstSearchParamValue(params.notice),
    warning: getFirstSearchParamValue(params.warning),
    error: getFirstSearchParamValue(params.error),
  };
}

export function parseAdminProductPageState(params: Record<string, SearchParamValue>) {
  const view: AdminView = getFirstSearchParamValue(params.view) === "featured" ? "featured" : "all";
  const selectedProductSlug = getFirstSearchParamValue(params.product)?.trim() || undefined;

  return {
    view,
    showingFeaturedOnly: view === "featured",
    selectedProductSlug,
    createNew: getFirstSearchParamValue(params.new) === "1",
  };
}

export function formatAdminDate(value?: string) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatAdminDateTime(value?: string) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatAdminCurrency(cents: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(cents / 100);
}

export function createAdminSearchParams(options: AdminPathOptions = {}) {
  const searchParams = new URLSearchParams();

  if (options.view === "featured") {
    searchParams.set("view", "featured");
  }

  if (options.productSlug) {
    searchParams.set("product", options.productSlug);
  }

  if (options.createNew) {
    searchParams.set("new", "1");
  }

  if (options.notice) {
    searchParams.set("notice", options.notice);
  }

  if (options.warning) {
    searchParams.set("warning", options.warning);
  }

  if (options.error) {
    searchParams.set("error", options.error);
  }

  return searchParams;
}

export function buildAdminPath(basePath: string, options: AdminPathOptions = {}) {
  const searchParams = createAdminSearchParams(options);
  return `${basePath}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
}

export function getAdminHref(options: AdminPathOptions = {}) {
  return buildAdminPath("/admin", options);
}

export function getAdminActiveSection(
  pathname: string,
  searchParams?: SearchParamReader | string,
): AdminSidebarSection {
  const resolvedSearchParams = getSearchParamReader(searchParams);

  return (
    ADMIN_NAV_ITEMS.find((item) => item.matches(pathname, resolvedSearchParams))?.id ?? "products"
  );
}
