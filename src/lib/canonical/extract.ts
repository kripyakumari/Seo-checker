import * as cheerio from "cheerio";
import type { CanonicalSource } from "./types";

export function extractCanonicals(html: string, baseUrl: string, linkHeader: string | null): CanonicalSource[] {
  const $ = cheerio.load(html);
  const found: CanonicalSource[] = [];

  $("link").each((_, el) => {
    const rel = (($(el).attr("rel") || "") as string).toLowerCase().split(/\s+/);
    if (!rel.includes("canonical")) return;
    const raw = ($(el).attr("href") || "").trim();
    if (!raw) return;
    const inHead = $(el).parents("head").length > 0;
    const inBody = $(el).parents("body").length > 0;
    found.push(makeSource(raw, baseUrl, { inHead: inHead || (!inHead && !inBody), inBody, fromHeader: false }));
  });

  for (const raw of parseLinkHeader(linkHeader)) {
    if (found.some((item) => item.raw === raw || item.resolved === resolve(raw, baseUrl))) continue;
    found.push(makeSource(raw, baseUrl, { inHead: true, inBody: false, fromHeader: true }));
  }

  return found;
}

export function readNoindex(html: string, robotsHeader: string | null) {
  if (robotsHeader && /\bnoindex\b/i.test(robotsHeader)) return true;
  const $ = cheerio.load(html);
  let noindex = false;
  $("meta").each((_, el) => {
    const name = (($(el).attr("name") || $(el).attr("property") || "") as string).toLowerCase();
    if (name !== "robots" && name !== "googlebot") return;
    const content = ($(el).attr("content") || "").toLowerCase();
    if (/\bnoindex\b/.test(content)) noindex = true;
  });
  return noindex;
}

export function suggestedCanonical(finalUrl: string) {
  try {
    const url = new URL(finalUrl);
    url.protocol = "https:";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid$|fbclid$|msclkid$|session$|sessionid$|phpsessid$|jsessionid$|sid$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return finalUrl;
  }
}

export function suggestedTag(finalUrl: string) {
  return `<link rel="canonical" href="${suggestedCanonical(finalUrl)}" />`;
}

function makeSource(raw: string, baseUrl: string, flags: { inHead: boolean; inBody: boolean; fromHeader: boolean }): CanonicalSource {
  const absolute = /^https?:\/\//i.test(raw);
  return {
    raw,
    resolved: resolve(raw, baseUrl),
    absolute,
    inHead: flags.inHead,
    inBody: flags.inBody,
    fromHeader: flags.fromHeader,
  };
}

function resolve(raw: string, baseUrl: string) {
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseLinkHeader(header: string | null) {
  if (!header) return [] as string[];
  const values: string[] = [];
  for (const part of header.split(",")) {
    if (!/rel\s*=\s*"?canonical"?/i.test(part)) continue;
    const match = part.match(/<([^>]+)>/);
    if (match?.[1]) values.push(match[1].trim());
  }
  return values;
}
