import { evaluateTitle } from "./checks";
import { extractTitleData } from "./extract";
import { FetchError, fetchPage } from "./fetch-page";
import type { AnalyzeResult } from "./types";
import { brandFromUrl, prepareUrl } from "./url";

export async function analyzeMetaTitle(input: {
  url?: string;
  keyword?: string;
  brand?: string;
}): Promise<AnalyzeResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const keyword = cleanOptional(input.keyword, "focus keyword", 80);
  if (!keyword.ok) return keyword;
  const brand = cleanOptional(input.brand, "brand name", 60);
  if (!brand.ok) return brand;

  try {
    const page = await fetchPage(prepared.url);
    const extracted = extractTitleData(page.html);
    if (extracted.challenge) {
      return {
        ok: false,
        error: "The site blocked the checker before the real page loaded.",
        hint: "Try again in a moment, or check a page that is public without a bot wall.",
      };
    }
    if (page.truncated && extracted.titles.length === 0) {
      return {
        ok: false,
        error: "The page was too large to find a title.",
        hint: "Check a normal HTML page rather than a very large document.",
      };
    }

    const domainBrand = brandFromUrl(page.finalUrl);
    const evaluation = evaluateTitle({
      title: extracted.title,
      titleCount: extracted.titles.length,
      h1: extracted.h1,
      h1Count: extracted.h1Count,
      ogTitle: extracted.ogTitle,
      keyword: "",
      brand: domainBrand,
    });

    return {
      ok: true,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: page.responseMs,
      redirectCount: page.redirectCount,
      titleCount: extracted.titles.length,
      h1: extracted.h1,
      h1Count: extracted.h1Count,
      ogTitle: extracted.ogTitle,
      metaDescription: extracted.metaDescription,
      keyword: "",
      brand: domainBrand,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof FetchError) {
      return { ok: false, error: error.message, hint: error.hint };
    }
    throw error;
  }
}

function cleanOptional(value: string | undefined, label: string, max: number) {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return { ok: true as const, value: "" };
  if (cleaned.length > max) {
    return {
      ok: false as const,
      error: `The ${label} is too long.`,
      hint: `Keep the ${label} under ${max} characters.`,
    };
  }
  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    return {
      ok: false as const,
      error: `Enter a real ${label}.`,
      hint: "Use letters or numbers, not symbols on their own.",
    };
  }
  return { ok: true as const, value: cleaned };
}
