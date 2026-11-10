import { pageKeywordSignals, resolveFocusKeyword } from "@/lib/focus-from-page";
import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateHeadings } from "./checks";
import { extractHeadings } from "./extract";
import type { HeadingResult } from "./types";

export async function analyzeHeadings(input: { url?: string; keyword?: string }): Promise<HeadingResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const typed = (input.keyword ?? "").replace(/\s+/g, " ").trim();
  if (typed.length > 80) {
    return { ok: false, error: "The focus keyword is too long.", hint: "Keep the focus keyword under 80 characters." };
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
    const extracted = extractHeadings(page.html);
    const keyword = resolveFocusKeyword(typed, pageKeywordSignals(page.html)).keyword;
    const evaluation = evaluateHeadings({ ...extracted, keyword });
    return {
      ok: true,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: page.responseMs,
      redirectCount: page.redirectCount,
      keyword,
      title: extracted.title,
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
