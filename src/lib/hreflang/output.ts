import type { HreflangLink } from "./types";
import { absoluteUrl, isFullUrl } from "./parse";

export function renderHtml(links: HreflangLink[], base = "") {
  return usable(links, base)
    .map((link) => `<link rel="alternate" hreflang="${escapeHtml(link.code)}" href="${escapeHtml(link.href)}" />`)
    .join("\n");
}

export function renderXml(links: HreflangLink[], base = "") {
  const rows = usable(links, base);
  if (rows.length === 0) return "";
  const blocks = rows.map((page) => {
    const alternates = rows.map((link) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(link.code)}" href="${escapeXml(link.href)}" />`).join("\n");
    return `  <url>\n    <loc>${escapeXml(page.href)}</loc>\n${alternates}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${blocks.join("\n")}\n</urlset>`;
}

export function renderHeader(links: HreflangLink[], base = "") {
  return usable(links, base)
    .map((link) => `<${link.href}>; rel="alternate"; hreflang="${link.code}"`)
    .join(", ");
}

export const CMS_STEPS =
  "Put this same set on every version. WordPress: print the link tags in the theme header. Shopify: add them in theme.liquid. Next.js: set metadata.alternates.languages to each hreflang and its full URL.";

function usable(links: HreflangLink[], base: string) {
  const seen = new Set<string>();
  const rows: HreflangLink[] = [];
  for (const link of links) {
    const href = isFullUrl(link.href) ? link.href.trim() : absoluteUrl(link.href, base);
    if (!isFullUrl(href)) continue;
    const key = `${link.code.trim().toLowerCase()} ${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ code: link.code.trim(), href });
  }
  return rows;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeXml(value: string) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}
