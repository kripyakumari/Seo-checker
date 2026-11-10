import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { assertPublic } from "@/lib/images/public-url";
import { extractInternalLinks, looksLikePage, normalizeLink, sameSite } from "./extract";
import type { CrawledPage, SiteCrawl } from "./types";

const PAGE_CAP = 12;
const SITEMAP_CAP = 40;

export async function crawlSite(homeUrl: string, seed: { url: string; html: string }): Promise<SiteCrawl> {
  const home = normalizeLink(homeUrl);
  const pages: CrawledPage[] = [];
  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: home, depth: 0 }];
  let homeFetched = false;
  let capped = false;

  while (queue.length > 0 && pages.length < PAGE_CAP) {
    const item = queue.shift();
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    let html = "";
    let finalUrl = item.url;
    if (normalizeLink(seed.url) === item.url) {
      html = seed.html;
      finalUrl = seed.url;
      if (item.depth === 0) homeFetched = true;
    } else {
      try {
        const page = await fetchPage(item.url);
        html = page.html;
        finalUrl = page.finalUrl;
        if (item.depth === 0) homeFetched = true;
      } catch (error) {
        if (!(error instanceof FetchError)) throw error;
        if (item.depth === 0 && item.url === home) {
          const seedKey = normalizeLink(seed.url);
          if (!seen.has(seedKey)) queue.unshift({ url: seedKey, depth: 0 });
        }
        continue;
      }
    }
    const key = normalizeLink(finalUrl);
    if (key !== item.url && seen.has(key)) continue;
    seen.add(key);
    const extracted = extractInternalLinks(html, finalUrl);
    const out = [...new Set(extracted.links.map((link) => link.href))];
    pages.push({ url: key, depth: item.depth, out });
    for (const target of out) {
      if (seen.has(target) || !looksLikePage(target)) continue;
      queue.push({ url: target, depth: item.depth + 1 });
    }
  }
  if (queue.length > 0) capped = true;

  const sitemapUrls = await readSitemap(new URL(home).origin, home);
  return { pages, capped, homeFetched, sitemapUrls };
}

async function readSitemap(origin: string, home: string) {
  const found: string[] = [];
  let maps: string[] = [];
  try {
    const robots = await fetchText(`${origin}/robots.txt`);
    maps = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((match) => match[1]);
  } catch {
    maps = [];
  }
  if (maps.length === 0) maps = [`${origin}/sitemap.xml`];
  const pending = maps.slice(0, 3);
  const seenMaps = new Set<string>();
  while (pending.length > 0 && found.length < SITEMAP_CAP && seenMaps.size < 4) {
    const map = pending.shift();
    if (!map || seenMaps.has(map)) continue;
    seenMaps.add(map);
    let xml = "";
    try {
      xml = await fetchText(map);
    } catch {
      continue;
    }
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => decode(match[1].trim()));
    for (const loc of locs) {
      if (/\.xml($|\?)/i.test(loc)) {
        if (seenMaps.size + pending.length < 4) pending.push(loc);
        continue;
      }
      try {
        if (!sameSite(loc, home) || !looksLikePage(loc)) continue;
        found.push(normalizeLink(loc));
      } catch {
        continue;
      }
      if (found.length >= SITEMAP_CAP) break;
    }
  }
  return [...new Set(found)];
}

async function fetchText(url: string) {
  await assertPublic(url);
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "text/plain,application/xml,text/xml,*/*", "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("unavailable");
  }
  const text = await response.text();
  return text.slice(0, 200_000);
}

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
