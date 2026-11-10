import { resolveFocusKeyword, resolveSecondaryKeywords } from "@/lib/focus-from-page";
import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateKeyword } from "./checks";
import { extractKeywordPage } from "./extract";
import type { KeywordResult } from "./types";

export async function analyzeKeyword(input: {
  url?: string;
  keyword?: string;
  secondary?: string;
}): Promise<KeywordResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const typed = (input.keyword ?? "").replace(/\s+/g, " ").trim();
  if (typed.length > 80) {
    return {
      ok: false,
      error: "The focus keyword is too long.",
      hint: "Keep the focus keyword under 80 characters.",
    };
  }

  try {
    const page = await fetchPage(prepared.url);
    if (isChallenge(page.html)) {
      return {
        ok: false,
        error: "The site blocked the checker before the real page loaded.",
        hint: "Try again in a moment, or check a page that is public without a bot wall.",
      };
    }
    const extracted = extractKeywordPage(page.html, page.finalUrl);
    const picked = resolveFocusKeyword(typed, extracted);
    if (!picked.keyword) {
      return {
        ok: false,
        error: "No focus keyword found on the page.",
        hint: "This page has no usable title or H1, so the keyword checks cannot run.",
      };
    }
    const secondary = resolveSecondaryKeywords(input.secondary ?? "", extracted.h2, picked.keyword);
    const evaluation = evaluateKeyword(extracted, picked.keyword);
    return {
      ok: true,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: page.responseMs,
      redirectCount: page.redirectCount,
      keyword: picked.keyword,
      keywordSource: picked.source,
      secondary,
      title: extracted.title,
      wordCount: extracted.wordCount,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: error.message, hint: error.hint };
    throw error;
  }
}

function isChallenge(html: string) {
  const sample = html.slice(0, 4000).toLowerCase();
  return sample.includes("cf-browser-verification") || sample.includes("cf-challenge") || sample.includes("/cdn-cgi/challenge-platform");
}
