import { assertPublic, FetchError } from "@/lib/images/public-url";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateCanonical } from "./checks";
import { extractCanonicals, readNoindex, suggestedTag } from "./extract";
import type { CanonicalProbe, CanonicalResult } from "./types";

const HOP_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 400_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Chain = {
  reached: boolean;
  finalUrl: string;
  statusCode: number;
  redirectCount: number;
  html: string;
  linkHeader: string | null;
  robotsHeader: string | null;
};

export async function analyzeCanonical(input: { url?: string }): Promise<CanonicalResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const started = Date.now();
  try {
    const page = await fetchChain(prepared.url);
    if (!page.reached || page.statusCode >= 400 || page.statusCode < 200) {
      return {
        ok: false,
        error: page.reached ? `The page returned HTTP ${page.statusCode}.` : "Wrong URL or page down.",
        hint: "Open the URL in a browser, then paste the working address.",
      };
    }

    const sources = extractCanonicals(page.html, page.finalUrl, page.linkHeader);
    const primary = sources[0]?.resolved ?? null;
    const probe = primary ? await probeCanonical(primary) : null;
    const sitemapNote = await checkSitemap(page.finalUrl, primary);
    const versions = primary ? await probeOtherVersions(primary) : [];

    const evaluation = evaluateCanonical({
      pageUrl: page.finalUrl,
      sources,
      probe,
      sitemapNote,
      otherVersions: versions,
    });

    return {
      ok: true,
      ...evaluation,
      suggestedTag: evaluation.suggestedTag || suggestedTag(page.finalUrl),
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseMs: Date.now() - started,
      redirectCount: page.redirectCount,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: error.message, hint: error.hint };
    throw error;
  }
}

async function probeCanonical(canonicalUrl: string): Promise<CanonicalProbe> {
  const chain = await fetchChain(canonicalUrl);
  if (!chain.reached) {
    return {
      reached: false,
      statusCode: 0,
      finalUrl: canonicalUrl,
      redirectCount: 0,
      noindex: false,
      selfCanonical: null,
      robotsBlocked: null,
    };
  }
  const self = extractCanonicals(chain.html, chain.finalUrl, chain.linkHeader)[0]?.resolved ?? null;
  const robotsBlocked = await pathBlocked(canonicalUrl);
  return {
    reached: true,
    statusCode: chain.statusCode,
    finalUrl: chain.finalUrl,
    redirectCount: chain.redirectCount,
    noindex: readNoindex(chain.html, chain.robotsHeader),
    selfCanonical: self,
    robotsBlocked,
  };
}

async function pathBlocked(pageUrl: string) {
  try {
    const origin = new URL(pageUrl).origin;
    const robots = await fetchText(`${origin}/robots.txt`);
    if (!robots) return false;
    const rules = starDisallows(robots);
    if (rules.length === 0) return false;
    const path = new URL(pageUrl).pathname;
    return rules.some((rule) => path === rule || path.startsWith(rule));
  } catch {
    return null;
  }
}

async function checkSitemap(pageUrl: string, canonicalUrl: string | null) {
  if (!canonicalUrl) {
    return { status: "info" as const, found: "Not checked, because no canonical URL was found.", fix: null, details: "" };
  }
  try {
    const origin = new URL(pageUrl).origin;
    const robots = await fetchText(`${origin}/robots.txt`);
    const maps = sitemapUrls(robots, origin).slice(0, 3);
    if (maps.length === 0) {
      return { status: "info" as const, found: "No sitemap was listed in robots.txt.", fix: null, details: "" };
    }
    for (const mapUrl of maps) {
      const xml = await fetchText(mapUrl);
      if (!xml) continue;
      const urls = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
      if (urls.some((item) => sameLoose(item, canonicalUrl))) {
        return { status: "pass" as const, found: "The sitemap lists the canonical URL.", fix: null, details: mapUrl };
      }
      const cousins = urls.filter((item) => samePathFamily(item, canonicalUrl));
      if (cousins.length > 0) {
        return {
          status: "warning" as const,
          found: "The sitemap lists another version of this URL.",
          fix: "List the canonical URL in the sitemap.",
          details: cousins.slice(0, 3).join("\n"),
        };
      }
    }
    return { status: "info" as const, found: "The canonical URL was not found in the sitemap files checked.", fix: null, details: maps.join("\n") };
  } catch {
    return { status: "info" as const, found: "The sitemap could not be read.", fix: null, details: "" };
  }
}

async function probeOtherVersions(canonicalUrl: string) {
  const versions = alternateUrls(canonicalUrl);
  const probes = await Promise.all(
    versions.map(async (version) => {
      const chain = await fetchChain(version.url);
      if (!chain.reached || chain.statusCode !== 200) {
        return { bad: false, detail: `${version.label}: ${chain.reached ? `HTTP ${chain.statusCode}` : "unreachable"}` };
      }
      const redirected = chain.redirectCount > 0 && sameLoose(chain.finalUrl, canonicalUrl);
      const self = extractCanonicals(chain.html, chain.finalUrl, chain.linkHeader)[0]?.resolved ?? null;
      const pointed = self != null && sameLoose(self, canonicalUrl);
      if (redirected || pointed || sameLoose(chain.finalUrl, canonicalUrl)) {
        return { bad: false, detail: `${version.label}: ok` };
      }
      return { bad: true, detail: `${version.label}: ${version.url} returns HTTP 200` };
    }),
  );
  return probes;
}

function alternateUrls(canonicalUrl: string) {
  const url = new URL(canonicalUrl);
  const versions: { label: string; url: string }[] = [];
  if (url.protocol === "https:") {
    const http = new URL(canonicalUrl);
    http.protocol = "http:";
    versions.push({ label: "http", url: http.toString() });
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes(":")) {
    const flipped = new URL(canonicalUrl);
    flipped.hostname = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
    versions.push({ label: flipped.hostname.startsWith("www.") ? "www" : "non-www", url: flipped.toString() });
  }
  if (url.pathname !== "/") {
    const slash = new URL(canonicalUrl);
    slash.pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : `${url.pathname}/`;
    versions.push({ label: "trailing slash", url: slash.toString() });
  }
  return versions.filter((item) => item.url !== canonicalUrl);
}

async function fetchChain(start: string): Promise<Chain> {
  let current = start;
  let redirectCount = 0;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublic(current);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HOP_TIMEOUT_MS);
      try {
        const response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "User-Agent": USER_AGENT },
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || hop === MAX_REDIRECTS) {
            return { reached: true, finalUrl: current, statusCode: response.status, redirectCount, html: "", linkHeader: null, robotsHeader: null };
          }
          current = new URL(location, current).toString();
          redirectCount += 1;
          continue;
        }
        const html = await readText(response);
        return {
          reached: true,
          finalUrl: current,
          statusCode: response.status,
          redirectCount,
          html,
          linkHeader: response.headers.get("link"),
          robotsHeader: response.headers.get("x-robots-tag"),
        };
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    if (error instanceof FetchError || error instanceof Error) {
      return { reached: false, finalUrl: current, statusCode: 0, redirectCount, html: "", linkHeader: null, robotsHeader: null };
    }
    throw error;
  }
  return { reached: false, finalUrl: current, statusCode: 0, redirectCount, html: "", linkHeader: null, robotsHeader: null };
}

async function fetchText(url: string) {
  await assertPublic(url);
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
    headers: { Accept: "text/plain,application/xml,text/xml,*/*;q=0.8", "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return "";
  }
  return readText(response);
}

async function readText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    size += step.value.byteLength;
  }
  await reader.cancel();
  const buffer = new Uint8Array(Math.min(size, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, Math.max(0, MAX_BYTES - offset));
    buffer.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= MAX_BYTES) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer.subarray(0, offset));
}

function starDisallows(text: string) {
  const lines = text.split(/\r?\n/);
  const rules: string[] = [];
  let inStar = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [rawKey, ...rest] = trimmed.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      inStar = value === "*";
      continue;
    }
    if (!inStar || key !== "disallow" || !value || value === "/") continue;
    rules.push(value);
  }
  return rules;
}

function sitemapUrls(robots: string, origin: string) {
  const listed = [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((match) => match[1].trim());
  if (listed.length) return listed;
  return [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
}

function sameLoose(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => (value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value);
    return a.host.replace(/^www\./i, "").toLowerCase() === b.host.replace(/^www\./i, "").toLowerCase() && path(a.pathname) === path(b.pathname);
  } catch {
    return false;
  }
}

function samePathFamily(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => (value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value).toLowerCase();
    return a.host.replace(/^www\./i, "").toLowerCase() === b.host.replace(/^www\./i, "").toLowerCase() && path(a.pathname) === path(b.pathname) && a.toString() !== b.toString();
  } catch {
    return false;
  }
}
