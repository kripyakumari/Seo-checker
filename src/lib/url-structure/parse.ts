import type { UrlParts } from "./types";

const TRACKING = /^(utm_|gclid$|fbclid$|msclkid$|gbraid$|wbraid$|mc_eid$|session$|sessionid$|phpsessid$|jsessionid$|sid$|sort$|order$|orderby$|filter$|dir$)/i;

export function parseUrl(raw: string): UrlParts {
  const url = new URL(raw);
  const pathname = url.pathname || "/";
  const decodedPath = decodePath(pathname);
  const segments = (decodedPath ?? pathname).split("/").filter(Boolean);
  const slug = segments.at(-1) ?? "";
  const folders = Math.max(0, segments.length - 1);
  return {
    href: url.toString(),
    protocol: url.protocol,
    host: url.hostname,
    pathname,
    decodedPath,
    doubleEncoded: /%25[0-9a-f]{2}/i.test(pathname),
    slug,
    slugWords: slug.split(/[-_]+/).map((word) => word.toLowerCase()).filter(Boolean),
    folders,
    segments,
    queryKeys: [...url.searchParams.keys()],
    hash: url.hash,
  };
}

export function cleanUrl(raw: string) {
  const url = new URL(raw);
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  if (url.hash.startsWith("#/") || url.hash.startsWith("#!")) url.hash = "";
  const source = decodePath(url.pathname) ?? url.pathname;
  const segments = source.split("/").filter(Boolean).flatMap((segment) => {
    if (segment.toLowerCase() === "index.html") return [];
    const cleaned = [...segment.toLowerCase().replace(/[_\s]+/g, "-")]
      .filter((character) => /[\p{L}\p{N}]/u.test(character) || character === "-")
      .join("")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");
    return cleaned ? [cleaned] : [];
  });
  url.pathname = segments.length ? `/${segments.join("/")}` : "/";
  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);
  return url.toString();
}

export function isTrackingKey(key: string) {
  return TRACKING.test(key);
}

export function samePage(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => (value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value);
    return a.protocol === b.protocol && a.host.toLowerCase() === b.host.toLowerCase() && path(a.pathname) === path(b.pathname) && a.search === b.search;
  } catch {
    return false;
  }
}

function decodePath(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}
