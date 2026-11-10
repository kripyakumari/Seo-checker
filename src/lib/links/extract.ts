import * as cheerio from "cheerio";
import type { Element, ParentNode } from "domhandler";
import type { FoundLink, LinkPlace } from "./types";

const VAGUE = new Set(["click here", "read more", "learn more", "this"]);
const JS_WORDS = new Set(["void", "undefined", "null", "true", "false", "this", "return", "function", "window", "document", "location"]);
const PARAM = /^(utm_|session$|sessionid$|sid$|phpsessid$|jsessionid$|sort$|order$|orderby$)/i;
const ASSET = /\.(pdf|jpe?g|png|gif|webp|svg|zip|css|js|xml|json|mp4|mp3|ico|woff2?)$/i;

export function extractInternalLinks(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const links: FoundLink[] = [];
  $("a[href]").each((_, element) => {
    if (inSkipped(element)) return;
    const resolved = resolveInternal($(element).attr("href") ?? "", pageUrl);
    if (!resolved) return;
    const text = clean($(element).text());
    const alt = $(element)
      .find("img")
      .toArray()
      .map((image) => clean($(image).attr("alt") ?? ""))
      .filter(Boolean)
      .join(" ");
    const label = text || alt;
    const rel = ($(element).attr("rel") ?? "").toLowerCase().split(/\s+/);
    links.push({
      href: normalizeLink(resolved.toString()),
      text: label,
      empty: label.length === 0,
      vague: isVague(label),
      nofollow: rel.includes("nofollow"),
      insecure: resolved.protocol === "http:",
      parameterized: hasParam(resolved),
      self: samePath(resolved, pageUrl),
      place: placeOf(element),
      shallow: isShallow(resolved),
    });
  });
  return { links, uncrawlable: collectUncrawlable($, pageUrl) };
}

export function normalizeLink(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.hostname = hostKey(parsed.hostname);
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) parsed.pathname = parsed.pathname.slice(0, -1);
  return parsed.toString();
}

export function sameSite(a: string, b: string) {
  return hostKey(new URL(a).hostname) === hostKey(new URL(b).hostname);
}

export function looksLikePage(url: string) {
  try {
    return !ASSET.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function resolveInternal(href: string, pageUrl: string) {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw, pageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!sameSite(parsed.toString(), pageUrl)) return null;
  parsed.hash = "";
  return parsed;
}

function placeOf(node: Element): LinkPlace {
  let current: Element | null = node;
  while (current) {
    const role = (current.attribs?.role ?? "").toLowerCase();
    const name = current.name.toLowerCase();
    if (name === "footer" || role === "contentinfo") return "footer";
    if (name === "aside" || role === "complementary") return "aside";
    if (name === "nav" || name === "header" || role === "navigation" || role === "banner") return "nav";
    current = asTag(current.parent);
  }
  return "body";
}

function hasParam(url: URL) {
  for (const key of url.searchParams.keys()) {
    if (PARAM.test(key)) return true;
  }
  return false;
}

function isShallow(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length <= 1;
}

function samePath(url: URL, pageUrl: string) {
  const page = new URL(pageUrl);
  return hostKey(url.hostname) === hostKey(page.hostname) && url.pathname.replace(/\/$/, "") === page.pathname.replace(/\/$/, "");
}

function hostKey(hostname: string) {
  return hostname.replace(/\.$/, "").replace(/^www\./i, "").toLowerCase();
}

function collectUncrawlable($: cheerio.CheerioAPI, pageUrl: string) {
  const found: string[] = [];
  $("a, span[href], div[href], button[href]").each((_, element) => {
    if (inSkipped(element)) return;
    const tag = element.name.toLowerCase();
    const href = ($(element).attr("href") ?? "").trim();
    if (tag === "a" && (resolveInternal(href, pageUrl) || isExternalHttp(href, pageUrl))) return;
    if (tag === "a" && (href.startsWith("#") || /^(mailto|tel|data):/i.test(href))) return;

    const candidates: string[] = [];
    if (/^javascript:/i.test(href)) candidates.push(...quotedTargets(href));
    for (const name of ["routerlink", "ng-href", "data-href", "data-url"]) {
      const value = attributeTarget($(element).attr(name));
      if (value) candidates.push(value);
    }
    if (tag !== "a") {
      const value = attributeTarget(href);
      if (value) candidates.push(value);
    }
    candidates.push(...quotedTargets($(element).attr("onclick") ?? ""));

    for (const candidate of candidates) {
      if (!isInternalTarget(candidate, pageUrl)) continue;
      const label = clean($(element).text()) || candidate;
      found.push(`${label} — ${candidate}`);
      break;
    }
  });
  return [...new Set(found)];
}

function isExternalHttp(href: string, pageUrl: string) {
  try {
    const parsed = new URL(href, pageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return !sameSite(parsed.toString(), pageUrl);
  } catch {
    return false;
  }
}

function isInternalTarget(value: string, pageUrl: string) {
  try {
    const parsed = new URL(value, pageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return sameSite(parsed.toString(), pageUrl);
  } catch {
    return false;
  }
}

function quotedTargets(value: string) {
  return [...value.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((item) => attributeTarget(item));
}

function attributeTarget(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw || raw.length > 300 || /[\s()]/.test(raw) || raw.startsWith("#")) return null;
  if (/^(javascript|mailto|tel|data):/i.test(raw)) return null;
  if (JS_WORDS.has(raw.toLowerCase())) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return raw;
  if (/^[\w.-]+(?:\/[\w.-]+)*$/.test(raw)) return raw;
  return null;
}

function isVague(label: string) {
  const text = plain(label);
  if (!text) return false;
  if (VAGUE.has(text)) return true;
  return /^(click here|read more|learn more)\b/.test(text);
}

function plain(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function inSkipped(node: Element) {
  let parent = asTag(node.parent);
  while (parent) {
    const name = parent.name.toLowerCase();
    if (name === "svg" || name === "math") return true;
    parent = asTag(parent.parent);
  }
  return false;
}

function asTag(node: ParentNode | null): Element | null {
  return node && node.type === "tag" ? node : null;
}
