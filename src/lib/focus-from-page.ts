import * as cheerio from "cheerio";
import { cleanText } from "@/lib/meta-title/extract";

export type FocusSource = "entered" | "h1" | "title";

export type PageKeywordSignals = {
  title: string;
  h1: string[];
  h2: string[];
};

export function pageKeywordSignals(html: string): PageKeywordSignals {
  const $ = cheerio.load(html);
  let title = "";
  $("title").each((_, el) => {
    if (title) return;
    title = cleanText($(el).text());
  });
  const h1: string[] = [];
  $("h1").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) h1.push(text);
  });
  const h2: string[] = [];
  $("h2").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) h2.push(text);
  });
  return { title, h1, h2 };
}

export function resolveFocusKeyword(
  typed: string,
  signals: { title: string; h1: string[] },
): { keyword: string; source: FocusSource } {
  const clean = typed.replace(/\s+/g, " ").trim();
  if (clean) return { keyword: clean.slice(0, 80), source: "entered" };
  const fromH1 = clipFocusPhrase(signals.h1[0] ?? "");
  if (fromH1) return { keyword: fromH1, source: "h1" };
  const fromTitle = clipFocusPhrase(signals.title);
  if (fromTitle) return { keyword: fromTitle, source: "title" };
  return { keyword: "", source: "entered" };
}

export function resolveSecondaryKeywords(typed: string, h2: string[], focus: string): string[] {
  const fromTyped = typed
    .split(/[,;\n]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);
  if (fromTyped.length) return fromTyped;

  const focusNorm = normalizePhrase(focus);
  const out: string[] = [];
  for (const heading of h2) {
    const clipped = clipFocusPhrase(heading);
    if (!clipped) continue;
    if (normalizePhrase(clipped) === focusNorm) continue;
    if (out.some((item) => normalizePhrase(item) === normalizePhrase(clipped))) continue;
    out.push(clipped);
    if (out.length >= 3) break;
  }
  return out;
}

export function clipFocusPhrase(value: string) {
  const words = value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 8);
  const text = words.join(" ").trim();
  if (text.length <= 80) return text;
  return text.slice(0, 80).replace(/\s+\S*$/, "").trim();
}

function normalizePhrase(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
