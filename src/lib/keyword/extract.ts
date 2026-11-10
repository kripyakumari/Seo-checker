import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { cleanText } from "@/lib/meta-title/extract";
import type { KeywordPage } from "./types";

export function extractKeywordPage(html: string, finalUrl: string): KeywordPage {
  const $ = cheerio.load(html);
  $("script, style, noscript, template, svg, iframe").remove();

  const titles: string[] = [];
  $("title").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) titles.push(text);
  });

  const h1: string[] = [];
  $("h1").each((_, el) => {
    const text = headingText($, el);
    if (text) h1.push(text);
  });

  const h2: string[] = [];
  $("h2").each((_, el) => {
    const text = headingText($, el);
    if (text) h2.push(text);
  });

  const headings: string[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = headingText($, el);
    if (text) headings.push(text);
  });

  let metaDescription = "";
  $("meta").each((_, el) => {
    const key = ($(el).attr("name") || $(el).attr("property") || "").toLowerCase();
    if (key === "description" || key === "og:description") {
      const content = cleanText($(el).attr("content"));
      if (content && !metaDescription) metaDescription = content;
    }
  });

  const alts: string[] = [];
  $("img").each((_, el) => {
    if ($(el).attr("alt") == null) return;
    const alt = cleanText($(el).attr("alt"));
    if (alt) alts.push(alt);
  });

  const clone = cheerio.load(html);
  clone("script, style, noscript, template, svg, iframe, nav, footer, header, aside, form").remove();
  clone("[role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']").remove();
  const article = clone("article").first();
  const main = clone("main").first();
  const root = article.length ? article : main.length ? main : clone("body");
  const paragraphs: string[] = [];
  root.find("p").each((_, el) => {
    if (clone(el).parents("p").length) return;
    const text = cleanText(clone(el).text());
    if (text) paragraphs.push(text);
  });
  if (paragraphs.length === 0) {
    const plain = cleanText(root.text());
    if (plain) paragraphs.push(plain);
  }

  const bodyText = paragraphs.join(" ");
  const wordCount = wordsOf(bodyText).length;
  return {
    title: titles[0] ?? "",
    h1,
    h2,
    headings,
    metaDescription,
    slug: slugOf(finalUrl),
    alts,
    paragraphs,
    bodyText,
    wordCount,
  };
}

function headingText($: cheerio.CheerioAPI, el: Element) {
  const node = $(el).clone();
  node.find("script, style, noscript").remove();
  let text = cleanText(node.text());
  if (!text) {
    node.find("img").each((_, image) => {
      const alt = cleanText($(image).attr("alt"));
      if (alt && !text) text = alt;
    });
  }
  return text;
}

function slugOf(finalUrl: string) {
  try {
    const path = new URL(finalUrl).pathname.replace(/\/+$/, "");
    if (!path || path === "/") return "";
    return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
  } catch {
    return "";
  }
}

export function wordsOf(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

export function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countExact(text: string, phrase: string) {
  const needle = normalize(phrase);
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  return [...normalize(text).matchAll(pattern)].length;
}

export function parseSecondary(raw: string) {
  return raw
    .split(/[,;\n]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);
}
