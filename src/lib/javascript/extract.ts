import * as cheerio from "cheerio";
import { cleanText } from "@/lib/meta-title/extract";
import type { ImageSignal, JsSnapshot, JsonLdBlock } from "./types";

const PRICE = /(?:[$₹€£]\s?\d|\d+[.,]\d{2}\s?(?:usd|eur|gbp|inr)?)/i;

export function readSnapshot(html: string, finalUrl: string, statusCode: number): JsSnapshot {
  const $ = cheerio.load(html || "");
  $("script, style, noscript, svg").remove();
  const title = cleanText($("title").first().text());
  const description = cleanText($('meta[name="description"]').attr("content") || "");
  const robots = cleanText($('meta[name="robots"]').attr("content") || "");
  const canonicalHref = $('link[rel="canonical"]').attr("href") || "";
  let canonical = "";
  if (canonicalHref) {
    try {
      canonical = new URL(canonicalHref, finalUrl).toString();
    } catch {
      canonical = canonicalHref;
    }
  }
  const h1: string[] = [];
  $("h1").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) h1.push(text);
  });
  const text = cleanText($("body").text());
  const words = text.split(/\s+/).filter(Boolean);
  const prices = [...text.matchAll(new RegExp(PRICE, "gi"))].map((match) => match[0]).slice(0, 6);

  const pageHost = hostOf(finalUrl);
  const internalLinks: string[] = [];
  let realLinks = 0;
  let weakLinks = 0;
  $("a").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const onclick = Boolean($(el).attr("onclick"));
    if (!href || href === "#" || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
      if (href || onclick) weakLinks += 1;
      return;
    }
    try {
      const absolute = new URL(href, finalUrl);
      if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return;
      realLinks += 1;
      if (pageHost && absolute.hostname.replace(/^www\./, "") === pageHost) internalLinks.push(absolute.toString());
    } catch {
      weakLinks += 1;
    }
  });
  $("[onclick]").each((_, el) => {
    if ($(el).is("a")) return;
    weakLinks += 1;
  });

  const withScripts = cheerio.load(html || "");
  const jsonLd: JsonLdBlock[] = [];
  withScripts('script[type="application/ld+json"]').each((_, el) => {
    const raw = withScripts(el).text().trim();
    if (!raw) return;
    try {
      JSON.parse(raw);
      jsonLd.push({ valid: true, text: raw.slice(0, 240) });
    } catch {
      jsonLd.push({ valid: false, text: raw.slice(0, 240) });
    }
  });
  const images: ImageSignal[] = [];
  withScripts("img").each((_, el) => {
    const src = withScripts(el).attr("src") || "";
    const loading = (withScripts(el).attr("loading") || "").toLowerCase();
    const dataSrc = Boolean(withScripts(el).attr("data-src") || withScripts(el).attr("data-lazy-src"));
    images.push({ src, loading, dataSrc });
  });
  const scripts: string[] = [];
  withScripts("script[src]").each((_, el) => {
    const src = withScripts(el).attr("src") || "";
    if (src) scripts.push(resolveAsset(src, finalUrl));
  });
  const stylesheets: string[] = [];
  withScripts('link[rel="stylesheet"][href]').each((_, el) => {
    const href = withScripts(el).attr("href") || "";
    if (href) stylesheets.push(resolveAsset(href, finalUrl));
  });

  const root = withScripts("#root, #app, #__next, #___gatsby").first();
  const rootWords = cleanText(root.text()).split(/\s+/).filter(Boolean).length;
  const emptyRoot = root.length > 0 && words.length < 25 && rootWords < 12;

  return {
    statusCode,
    finalUrl,
    title,
    description,
    canonical,
    robots,
    h1,
    text,
    wordCount: words.length,
    prices,
    internalLinks: [...new Set(internalLinks)].slice(0, 40),
    realLinks,
    weakLinks,
    jsonLd,
    images,
    scripts: [...new Set(scripts)].slice(0, 30),
    stylesheets: [...new Set(stylesheets)].slice(0, 20),
    emptyRoot,
  };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function resolveAsset(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}
