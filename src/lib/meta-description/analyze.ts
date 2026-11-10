import { pageKeywordSignals, resolveFocusKeyword } from "@/lib/focus-from-page";
import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateDescription } from "./checks";
import { extractDescriptionData } from "./extract";
import type { DescriptionResult } from "./types";

export async function analyzeMetaDescription(input: {
  url?: string;
  keyword?: string;
}): Promise<DescriptionResult> {
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
    const extracted = extractDescriptionData(page.html);
    if (extracted.challenge) {
      return {
        ok: false,
        error: "The site blocked the checker before the real page loaded.",
        hint: "Try again in a moment, or check a page that is public without a bot wall.",
      };
    }

    const keyword = resolveFocusKeyword(typed, pageKeywordSignals(page.html)).keyword;
    const evaluation = evaluateDescription({
      description: extracted.description,
      descriptionCount: extracted.descriptionCount,
      title: extracted.title,
      ogDescription: extracted.ogDescription,
      keyword,
      firstParagraph: extracted.firstParagraph,
    });

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
      descriptionCount: extracted.descriptionCount,
      ogDescription: extracted.ogDescription,
      firstParagraph: extracted.firstParagraph,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: error.message, hint: error.hint };
    throw error;
  }
}
