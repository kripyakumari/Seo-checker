import { pageKeywordSignals, resolveFocusKeyword } from "@/lib/focus-from-page";
import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateLinks } from "./checks";
import { crawlSite } from "./crawl";
import { extractInternalLinks, normalizeLink } from "./extract";
import { probeTargets } from "./probe";
import type { LinkMode, LinkResult } from "./types";

const TARGET_CAP = 12;

export async function analyzeLinks(input: { url?: string; keyword?: string; mode?: string }): Promise<LinkResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const typed = (input.keyword ?? "").replace(/\s+/g, " ").trim();
  if (typed.length > 80) {
    return { ok: false, error: "The focus keyword is too long.", hint: "Keep the focus keyword under 80 characters." };
  }
  const mode: LinkMode = input.mode === "site" ? "site" : "page";

  try {
    const page = await fetchPage(prepared.url);
    if (isChallenge(page.html)) {
      return {
        ok: false,
        error: "The site blocked the checker before the real page loaded.",
        hint: "Try again in a moment, or check a page that is public without a bot wall.",
      };
    }
    const keyword = resolveFocusKeyword(typed, pageKeywordSignals(page.html)).keyword;
    const extracted = extractInternalLinks(page.html, page.finalUrl);
    const targets = [...new Set(extracted.links.filter((link) => !link.self).map((link) => link.href))];
    const probes = await probeTargets(targets.slice(0, TARGET_CAP));
    let site = null;
    if (mode === "site") {
      try {
        const home = new URL(page.finalUrl);
        home.pathname = "/";
        home.search = "";
        home.hash = "";
        site = await crawlSite(home.toString(), { url: normalizeLink(page.finalUrl), html: page.html });
      } catch (error) {
        if (!(error instanceof FetchError)) throw error;
        site = null;
      }
    }
    const evaluation = evaluateLinks({
      links: extracted.links,
      probes,
      keyword,
      mode,
      site,
      targetsChecked: probes.length,
      targetsTotal: targets.length,
      uncrawlable: extracted.uncrawlable,
    });
    return {
      ok: true,
      mode,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: page.responseMs,
      redirectCount: page.redirectCount,
      keyword,
      crawledPages: site?.pages.length ?? 0,
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
