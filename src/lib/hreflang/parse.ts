import * as cheerio from "cheerio";
import type { HreflangLink } from "./types";

export function readHtmlSignals(html: string, pageUrl: string) {
  const $ = cheerio.load(html || "");
  const links: HreflangLink[] = [];
  $("link").each((_, el) => {
    const rel = ($(el).attr("rel") || "").toLowerCase().split(/\s+/);
    if (!rel.includes("alternate")) return;
    const code = ($(el).attr("hreflang") || "").trim();
    const href = ($(el).attr("href") || "").trim();
    if (!code || !href) return;
    links.push({ code, href });
  });
  const canonicalHref = $('link[rel="canonical"]').attr("href") || "";
  let canonical = "";
  if (canonicalHref) canonical = absoluteUrl(canonicalHref, pageUrl);
  const robots = [$('meta[name="robots"]').attr("content") || "", $('meta[name="googlebot"]').attr("content") || ""].join(" ");
  return { links, canonical, noindex: /noindex/i.test(robots) };
}

export function parseLinkHeader(value: string): HreflangLink[] {
  if (!value.trim()) return [];
  const links: HreflangLink[] = [];
  for (const part of value.split(/,(?=\s*<)/)) {
    const href = part.match(/<([^>]+)>/)?.[1]?.trim() || "";
    if (!href) continue;
    const rel = part.match(/(?:^|;)\s*rel\s*=\s*"?([^";]+)"?/i)?.[1] || "";
    if (!rel.toLowerCase().split(/\s+/).includes("alternate")) continue;
    const code = part.match(/hreflang\s*=\s*"?([^";,\s]+)"?/i)?.[1]?.trim() || "";
    if (!code) continue;
    links.push({ code, href });
  }
  return links;
}

export function parseSitemapDocument(xml: string) {
  const blocks = xml.match(/<url\b[\s\S]*?<\/url>/gi) || [];
  const urls = blocks.slice(0, 100).flatMap((block) => {
    const loc = decode(block.match(/<loc>\s*([^<]+)\s*<\/loc>/i)?.[1] || "");
    if (!loc) return [];
    const tags = block.match(/<(?:xhtml:)?link\b[^>]*>/gi) || [];
    const links = tags.flatMap((tag) => {
      const code = attr(tag, "hreflang");
      const href = attr(tag, "href");
      const rel = attr(tag, "rel").toLowerCase();
      if (!code || !href) return [];
      if (rel && rel !== "alternate") return [];
      return [{ code, href }];
    });
    return [{ loc, links }];
  });
  const children = [...xml.matchAll(/<sitemap\b[\s\S]*?<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => decode(match[1] || "")).filter(Boolean).slice(0, 3);
  return { urls, children, isSitemap: /<(urlset|sitemapindex)\b/i.test(xml) };
}

export function absoluteUrl(href: string, base: string) {
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return "";
  }
}

export function isFullUrl(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

export function sameUrl(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => value.replace(/\/+$/, "") || "/";
    return a.protocol === b.protocol && a.host.toLowerCase() === b.host.toLowerCase() && path(a.pathname) === path(b.pathname) && a.search === b.search;
  } catch {
    return false;
  }
}

export function noindexHeader(value: string) {
  return /noindex/i.test(value);
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.[2] || tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.[3] || tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.[4] || "";
}

function decode(value: string) {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}
