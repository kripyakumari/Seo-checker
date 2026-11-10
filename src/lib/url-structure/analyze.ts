import * as cheerio from "cheerio";
import { pageKeywordSignals, resolveFocusKeyword } from "@/lib/focus-from-page";
import { assertPublic, FetchError } from "@/lib/images/public-url";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateUrl } from "./checks";
import { cleanUrl, samePage } from "./parse";
import type { DuplicateProbe, RedirectHop, UrlResult, UrlTechnical } from "./types";

const HOP_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 400_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function analyzeUrl(input: { url?: string; keyword?: string }): Promise<UrlResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;
  const typed = (input.keyword ?? "").replace(/\s+/g, " ").trim();
  if (typed.length > 80) {
    return { ok: false, error: "The focus keyword is too long.", hint: "Keep the focus keyword under 80 characters." };
  }

  const started = Date.now();
  const main = await fetchChain(prepared.url);
  const target = main.finalUrl || prepared.url;
  const canonical = main.html ? readCanonical(main.html, target) : null;
  const keyword = resolveFocusKeyword(typed, pageKeywordSignals(main.html || "")).keyword;
  const technical: UrlTechnical = {
    reached: main.reached,
    hops: main.hops,
    statusCode: main.statusCode,
    canonical,
    httpRedirectsToHttps: null,
    duplicates: [],
  };

  if (main.reached && main.statusCode < 400) {
    const [httpProbe, duplicates] = await Promise.all([probeHttp(target), probeDuplicates(target)]);
    technical.httpRedirectsToHttps = httpProbe;
    technical.duplicates = duplicates;
  }

  const evaluation = evaluateUrl(target, keyword, technical);
  return {
    ok: true,
    ...evaluation,
    inputUrl: input.url?.trim() ?? prepared.url,
    finalUrl: main.reached ? target : prepared.url,
    statusCode: main.statusCode,
    responseMs: Date.now() - started,
    redirectCount: Math.max(0, main.hops.length - 1),
    reached: main.reached,
    keyword,
    checkedAt: new Date().toISOString(),
  };
}

async function probeHttp(finalUrl: string) {
  const url = new URL(finalUrl);
  if (url.protocol !== "https:") return null;
  url.protocol = "http:";
  const chain = await fetchChain(url.toString());
  if (!chain.reached) return false;
  const permanent = chain.hops.slice(0, -1).some((hop) => hop.status === 301 || hop.status === 308);
  return permanent && samePage(chain.finalUrl, finalUrl);
}

async function probeDuplicates(finalUrl: string): Promise<DuplicateProbe[]> {
  const primary = new URL(finalUrl);
  const versions = alternateUrls(primary);
  const probes = await Promise.all(versions.map(async (version) => ({ version, chain: await fetchChain(version.url) })));
  return probes.map(({ version, chain }) => {
    if (!chain.reached || chain.statusCode !== 200) {
      return { label: version.label, bad: false, detail: chain.reached ? `HTTP ${chain.statusCode}` : "Could not be opened" };
    }
    const canonical = chain.html ? readCanonical(chain.html, chain.finalUrl) : null;
    const redirected = chain.hops.slice(0, -1).some((hop) => hop.status === 301 || hop.status === 308) && samePage(chain.finalUrl, finalUrl);
    const pointed = canonical != null && samePage(canonical, finalUrl);
    if (redirected || pointed || samePage(chain.finalUrl, finalUrl)) {
      return { label: version.label, bad: false, detail: redirected ? "301 to this URL" : "Canonical points here" };
    }
    return { label: version.label, bad: true, detail: `${version.url} returns HTTP 200` };
  });
}

function alternateUrls(url: URL) {
  const versions: { label: string; url: string }[] = [];
  const host = url.hostname.toLowerCase();
  if (!host.includes(":")) {
    const flipped = new URL(url.toString());
    flipped.hostname = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
    versions.push({ label: flipped.hostname.startsWith("www.") ? "www" : "non-www", url: flipped.toString() });
  }
  if (url.pathname !== "/") {
    const slash = new URL(url.toString());
    slash.pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : `${url.pathname}/`;
    versions.push({ label: "trailing slash", url: slash.toString() });
  }
  if (/[\p{L}]/u.test(url.pathname) && url.pathname !== url.pathname.toUpperCase()) {
    const upper = new URL(url.toString());
    upper.pathname = url.pathname.toUpperCase();
    versions.push({ label: "uppercase", url: upper.toString() });
  }
  const index = new URL(url.toString());
  if (url.pathname.toLowerCase().endsWith("/index.html")) {
    index.pathname = url.pathname.replace(/\/index\.html$/i, "") || "/";
    versions.push({ label: "without index.html", url: index.toString() });
  } else {
    index.pathname = `${url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`}index.html`;
    versions.push({ label: "index.html", url: index.toString() });
  }
  const clean = cleanUrl(url.toString());
  return versions.filter((version) => version.url !== url.toString() && version.url !== clean);
}

type Chain = {
  reached: boolean;
  hops: RedirectHop[];
  finalUrl: string;
  statusCode: number;
  html: string;
};

async function fetchChain(start: string): Promise<Chain> {
  const hops: RedirectHop[] = [];
  let current = start;
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
        hops.push({ url: current, status: response.status });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || hop === MAX_REDIRECTS) return { reached: true, hops, finalUrl: current, statusCode: response.status, html: "" };
          current = new URL(location, current).toString();
          continue;
        }
        const html = await readText(response);
        return { reached: true, hops, finalUrl: current, statusCode: response.status, html };
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    if (error instanceof FetchError || error instanceof Error) {
      return { reached: false, hops, finalUrl: current, statusCode: 0, html: "" };
    }
    throw error;
  }
  return { reached: false, hops, finalUrl: current, statusCode: 0, html: "" };
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
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk.subarray(0, Math.max(0, MAX_BYTES - offset)), offset);
    offset += chunk.byteLength;
    if (offset >= MAX_BYTES) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer.subarray(0, Math.min(size, MAX_BYTES)));
}

function readCanonical(html: string, base: string) {
  const href = cheerio.load(html)('link[rel="canonical"]').attr("href")?.trim();
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
