import { pageKeywordSignals, resolveFocusKeyword } from "@/lib/focus-from-page";
import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateImages } from "./checks";
import { extractImages } from "./extract";
import { fetchRobotsBlocked, measureImages } from "./probe";
import type { ImageResult } from "./types";

export async function analyzeImages(input: { url?: string; keyword?: string }): Promise<ImageResult> {
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

    const extracted = extractImages(page.html, page.finalUrl);
    const keyword = resolveFocusKeyword(typed, pageKeywordSignals(page.html)).keyword;
    const measured = await measureImages(extracted.images);
    const blocked = await fetchRobotsBlocked(
      page.finalUrl,
      measured.map((image) => image.url),
    );
    const evaluation = evaluateImages({
      images: measured,
      keyword,
      robotsBlocked: blocked,
      pageHttps: page.finalUrl.startsWith("https:"),
    });
    if (extracted.images.length > measured.length) {
      evaluation.checks.push({
        id: "image-cap",
        parameter: "Images found",
        status: "info",
        found: `Checked the first ${measured.length} of ${extracted.images.length} images on this page.`,
        fix: "The rest were left out so the check stays fast. This does not lower the score.",
        points: 0,
      });
    }

    return {
      ok: true,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: page.responseMs,
      redirectCount: page.redirectCount,
      keyword,
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
