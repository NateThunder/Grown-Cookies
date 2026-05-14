function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseForwardedForHeader(value: string) {
  return value
    .split(",")
    .map((part) => normalizeText(part))
    .find(Boolean);
}

function parseRequestIp(value: string | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

export function getRequestIpAddress(request: Request) {
  return (
    parseRequestIp(request.headers.get("cf-connecting-ip")) ??
    parseRequestIp(request.headers.get("x-nf-client-connection-ip")) ??
    parseForwardedForHeader(request.headers.get("x-forwarded-for") ?? "") ??
    parseRequestIp(request.headers.get("x-real-ip"))
  );
}
