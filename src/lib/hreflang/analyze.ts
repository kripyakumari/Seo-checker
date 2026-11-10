import { assertPublic } from "@/lib/images/public-url";
import { FetchError } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { evaluateHreflang } from "./checks";
import { absoluteUrl, noindexHeader, parseLinkHeader, parseSitemapDocument, readHtmlSignals, sameUrl } from "./parse";
import type { HreflangLink, HreflangResult, PageEvidence } from "./types";

const OPEN_LIMIT = 30;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function analyzeHreflang(input: { url?: string }): Promise<HreflangResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const started = Date.now();
  try {
    const first = await openVersion(prepared.url);
    if (first.fetchError && first.statusCode === 0) {
      return { ok: false, error: first.fetchError, hint: "Check the public https URL and try again." };
    }
    const sitemapMode = looksLikeSitemap(first.html, first.contentType);
    const robots = new Map<string, string>();
    let pages: PageEvidence[] = [];
    let mode: "page" | "sitemap" = "page";

    if (sitemapMode) {
      mode = "sitemap";
      pages = await pagesFromSitemap(first.html, first.url, robots);
    } else {
      const sitemapLinks = await sitemapLinksFor(first.url);
      const source = toEvidence(first, sitemapLinks);
      source.robotsBlocked = await blocked(source.url, robots);
      const allTargets = collectTargets(source).filter((url) => !sameUrl(url, source.url));
      const targets = allTargets.slice(0, OPEN_LIMIT - 1);
      const opened = await mapLimit(targets, 4, (url) => openVersion(url));
      const rest = await Promise.all(opened.map(async (page) => {
        const evidence = toEvidence(page, []);
        evidence.robotsBlocked = await blocked(evidence.url, robots);
        return evidence;
      }));
      const pending = allTargets.slice(OPEN_LIMIT - 1).map((url) => unopened(url));
      pages = [source, ...rest, ...pending];
    }

    const evaluation = evaluateHreflang(pages);
    const statusCode = first.statusCode || 200;
    return {
      ok: true,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: first.url,
      statusCode,
      responseMs: Date.now() - started,
      redirectCount: first.redirectedTo ? 1 : 0,
      checkedAt: new Date().toISOString(),
      mode,
    };
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: error.message, hint: error.hint };
    throw error;
  }
}

async function pagesFromSitemap(xml: string, sitemapUrl: string, robots: Map<string, string>) {
  let document = parseSitemapDocument(xml);
  if (document.urls.length === 0 && document.children.length > 0) {
    for (const child of document.children) {
      const text = await readText(child);
      const parsed = parseSitemapDocument(text);
      document = { urls: [...document.urls, ...parsed.urls].slice(0, 100), children: [], isSitemap: true };
      if (document.urls.length >= 100) break;
    }
  }
  const listed = document.urls.filter((item) => item.loc).slice(0, 100);
  const toOpen = listed.slice(0, OPEN_LIMIT);
  const opened = await mapLimit(toOpen, 4, (item) => openVersion(item.loc));
  const pages: PageEvidence[] = [];
  for (const item of listed) {
    const live = opened.find((page) => sameUrl(page.url, item.loc) || page.requested === item.loc);
    if (live && live.opened) {
      const evidence = toEvidence(live, item.links);
      evidence.robotsBlocked = await blocked(evidence.url, robots);
      if (evidence.htmlLinks.length === 0) evidence.htmlLinks = item.links;
      pages.push(evidence);
    } else {
      pages.push({
        url: item.loc,
        statusCode: 0,
        redirectedTo: "",
        canonical: "",
        noindex: false,
        robotsBlocked: false,
        htmlLinks: [],
        headerLinks: [],
        sitemapLinks: item.links,
        fetchError: "",
        opened: false,
      });
    }
  }
  if (pages.length === 0) {
    pages.push({
      url: sitemapUrl,
      statusCode: 200,
      redirectedTo: "",
      canonical: "",
      noindex: false,
      robotsBlocked: false,
      htmlLinks: [],
      headerLinks: [],
      sitemapLinks: [],
      fetchError: "",
      opened: true,
    });
  }
  return pages;
}

type RawPage = {
  requested: string;
  url: string;
  statusCode: number;
  redirectedTo: string;
  html: string;
  headerLinks: HreflangLink[];
  noindex: boolean;
  contentType: string;
  fetchError: string;
  opened: boolean;
};

async function openVersion(url: string): Promise<RawPage> {
  let current = url;
  let firstStatus = 0;
  let redirectedTo = "";
  try {
    for (let hop = 0; hop < 5; hop += 1) {
      const response = await requestOnce(current);
      if (hop === 0) firstStatus = response.status;
      if (response.status >= 300 && response.status < 400 && response.location) {
        if (!redirectedTo) redirectedTo = new URL(response.location, current).toString();
        current = new URL(response.location, current).toString();
        continue;
      }
      const signals = readHtmlSignals(response.body, current);
      return {
        requested: url,
        url: current,
        statusCode: response.status,
        redirectedTo: firstStatus >= 300 && firstStatus < 400 ? redirectedTo || current : "",
        html: response.body,
        headerLinks: parseLinkHeader(response.link),
        noindex: signals.noindex || noindexHeader(response.xrobots),
        contentType: response.type,
        fetchError: "",
        opened: true,
      };
    }
    return emptyPage(url, "This URL redirected more than 5 times.");
  } catch (error) {
    if (error instanceof FetchError) return emptyPage(url, error.message);
    return emptyPage(url, "This version could not be opened.");
  }
}

function toEvidence(page: RawPage, sitemapLinks: HreflangLink[]): PageEvidence {
  const signals = readHtmlSignals(page.html, page.url);
  return {
    url: page.url,
    statusCode: page.statusCode,
    redirectedTo: page.redirectedTo,
    canonical: signals.canonical,
    noindex: page.noindex || signals.noindex,
    robotsBlocked: false,
    htmlLinks: signals.links,
    headerLinks: page.headerLinks,
    sitemapLinks,
    fetchError: page.fetchError,
    opened: page.opened,
  };
}

function collectTargets(page: PageEvidence) {
  const urls: string[] = [];
  for (const link of [...page.htmlLinks, ...page.headerLinks, ...page.sitemapLinks]) {
    const href = absoluteUrl(link.href, page.url);
    if (!href || !/^https?:\/\//i.test(href)) continue;
    if (urls.some((item) => sameUrl(item, href))) continue;
    urls.push(href);
  }
  return urls;
}

async function sitemapLinksFor(pageUrl: string) {
  const origin = originOf(pageUrl);
  const robots = await readText(`${origin}/robots.txt`);
  const declared = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((match) => match[1]).slice(0, 2);
  const seeds = declared.length > 0 ? declared : [`${origin}/sitemap.xml`];
  for (const seed of seeds) {
    const xml = await readText(seed);
    const found = linksForLoc(xml, pageUrl);
    if (found.length > 0) return found;
    const children = parseSitemapDocument(xml).children;
    for (const child of children) {
      const nested = linksForLoc(await readText(child), pageUrl);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function linksForLoc(xml: string, pageUrl: string) {
  return parseSitemapDocument(xml).urls.find((item) => sameUrl(item.loc, pageUrl))?.links || [];
}

async function blocked(url: string, cache: Map<string, string>) {
  const origin = originOf(url);
  if (!cache.has(origin)) cache.set(origin, await readText(`${origin}/robots.txt`));
  return robotsDisallow(cache.get(origin) || "", url);
}

async function requestOnce(url: string) {
  await assertPublic(url);
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
  });
  const status = response.status;
  const location = response.headers.get("location") || "";
  const link = response.headers.get("link") || "";
  const xrobots = response.headers.get("x-robots-tag") || "";
  const type = response.headers.get("content-type") || "";
  const body = status >= 200 && status < 300 ? (await response.text()).slice(0, 1_500_000) : "";
  if (status < 200 || status >= 300) await response.body?.cancel();
  return { status, location, link, xrobots, type, body };
}

async function readText(url: string) {
  try {
    await assertPublic(url);
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return "";
    return (await response.text()).slice(0, 500_000);
  } catch {
    return "";
  }
}

function looksLikeSitemap(body: string, contentType: string) {
  const head = body.trim().slice(0, 400);
  return /xml/i.test(contentType) && /<(urlset|sitemapindex)\b/i.test(head) || /^\s*(<\?xml[^>]*>\s*)?<(urlset|sitemapindex)\b/i.test(head);
}

function unopened(url: string): PageEvidence {
  return {
    url,
    statusCode: 0,
    redirectedTo: "",
    canonical: "",
    noindex: false,
    robotsBlocked: false,
    htmlLinks: [],
    headerLinks: [],
    sitemapLinks: [],
    fetchError: "",
    opened: false,
  };
}

function emptyPage(url: string, fetchError: string): RawPage {
  return {
    requested: url,
    url,
    statusCode: 0,
    redirectedTo: "",
    html: "",
    headerLinks: [],
    noindex: false,
    contentType: "",
    fetchError,
    opened: true,
  };
}

function originOf(url: string) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function robotsDisallow(robots: string, assetUrl: string) {
  if (!robots.trim()) return false;
  let path = "/";
  try {
    path = new URL(assetUrl).pathname || "/";
  } catch {
    return false;
  }
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  for (const group of robots.split(/\n\s*\n/)) {
    const lines = group.split(/\n/).map((line) => line.replace(/#.*$/, "").trim()).filter(Boolean);
    const agents = lines.filter((line) => /^user-agent:/i.test(line)).map((line) => line.split(":").slice(1).join(":").trim().toLowerCase());
    const allow = lines.filter((line) => /^allow:/i.test(line)).map((line) => line.split(":").slice(1).join(":").trim());
    const disallow = lines.filter((line) => /^disallow:/i.test(line)).map((line) => line.split(":").slice(1).join(":").trim());
    if (agents.length === 0) continue;
    groups.push({ agents, allow, disallow });
  }
  const exact = (name: string) => groups.filter((group) => group.agents.some((agent) => agent === name));
  const chosen = exact("googlebot").length > 0 ? exact("googlebot") : exact("*");
  let allowLength = -1;
  let disallowLength = -1;
  for (const group of chosen) {
    for (const rule of group.allow) allowLength = Math.max(allowLength, ruleLength(path, rule));
    for (const rule of group.disallow) disallowLength = Math.max(disallowLength, ruleLength(path, rule));
  }
  if (disallowLength < 0) return false;
  return disallowLength > allowLength;
}

function ruleLength(path: string, rule: string) {
  if (!rule) return -1;
  return rule === "/" || path.startsWith(rule) ? rule.length : -1;
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
