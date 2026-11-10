import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateReadability } from "./checks";
import { extractFromHtml, extractFromText } from "./extract";
import type { ReadabilityLanguage, ReadabilityResult } from "./types";

const TEXT_CAP = 80_000;

export async function analyzeReadability(input: { url?: string; text?: string; language?: string }): Promise<ReadabilityResult> {
  const language: ReadabilityLanguage = input.language === "hi" ? "hi" : "en";
  const text = (input.text ?? "").replace(/\u0000/g, "").trim();
  if (text) {
    const document = extractFromText(text.slice(0, TEXT_CAP), language);
    if (document.wordCount === 0) {
      return { ok: false, error: "The pasted text has no words to score.", hint: "Paste the article text, or enter a public page URL." };
    }
    return finish(document, {
      source: "text",
      inputUrl: input.url?.trim() ?? "",
      finalUrl: "Pasted text",
      statusCode: 0,
      responseMs: 0,
      redirectCount: 0,
      language,
    });
  }

  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;
  try {
    const page = await fetchPage(prepared.url);
    if (isChallenge(page.html)) {
      return {
        ok: false,
        error: "The site blocked the checker before the real page loaded.",
        hint: "Try again in a moment, or check a page that is public without a bot wall.",
      };
    }
    const document = extractFromHtml(page.html, language);
    if (document.wordCount === 0) {
      return { ok: false, error: "This page has no main text to score.", hint: "Open a page with article text, or paste the text into the box." };
    }
    return finish(document, {
      source: "page",
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: page.responseMs,
      redirectCount: page.redirectCount,
      language,
    });
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: error.message, hint: error.hint };
    throw error;
  }
}

function finish(
  document: ReturnType<typeof extractFromText>,
  meta: {
    source: "page" | "text";
    inputUrl: string;
    finalUrl: string;
    statusCode: number;
    responseMs: number;
    redirectCount: number;
    language: ReadabilityLanguage;
  },
): ReadabilityResult {
  return {
    ok: true,
    ...evaluateReadability(document),
    ...meta,
    checkedAt: new Date().toISOString(),
  };
}

function isChallenge(html: string) {
  const sample = html.slice(0, 4000).toLowerCase();
  return sample.includes("cf-browser-verification") || sample.includes("cf-challenge") || sample.includes("/cdn-cgi/challenge-platform");
}
