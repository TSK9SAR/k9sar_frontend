export function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  return raw;
}

export const api = (path: string) => {
  if (!path.startsWith("/")) path = "/" + path;
  return `/api${path}`;
};
