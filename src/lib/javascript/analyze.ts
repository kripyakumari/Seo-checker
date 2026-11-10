import { FetchError, fetchPage } from "@/lib/meta-title/fetch-page";
import { prepareUrl } from "@/lib/meta-title/url";
import { assertPublic } from "@/lib/images/public-url";
import { evaluateJavascript } from "./checks";
import { readSnapshot } from "./extract";
import { renderPage } from "./render";
import type { JavascriptResult } from "./types";

export async function analyzeJavascript(input: { url?: string }): Promise<JavascriptResult> {
  const prepared = prepareUrl(input.url ?? "");
  if (!prepared.ok) return prepared;

  const started = Date.now();
  try {
    const rawPage = await fetchPage(prepared.url);
    const [rendered, robotsText, sitemap] = await Promise.all([
      renderPage(rawPage.finalUrl),
      readText(originOf(rawPage.finalUrl) + "/robots.txt"),
      readSitemap(rawPage.finalUrl),
    ]);
    const raw = readSnapshot(rawPage.html, rawPage.finalUrl, rawPage.statusCode);
    const renderedSnapshot = rendered.ok ? readSnapshot(rendered.html, rendered.finalUrl || rawPage.finalUrl, rendered.statusCode || rawPage.statusCode) : null;
    const assets = [...raw.scripts, ...raw.stylesheets].slice(0, 12);
    const robotsBlocked = assets.filter((asset) => robotsDisallow(robotsText, asset));
    const sameTitleOnOtherRoute = await sharedTitle(rawPage.finalUrl, raw.title, sitemap.otherUrl);
    const evaluation = evaluateJavascript({
      raw,
      rendered: renderedSnapshot,
      renderMs: rendered.renderMs,
      consoleErrors: rendered.consoleErrors,
      failedAssets: rendered.failedAssets,
      robotsBlocked,
      scriptBytes: rendered.scriptBytes,
      renderError: rendered.ok ? "" : rendered.error,
      sitemapFound: sitemap.found,
      sitemapListed: sitemap.found ? sitemap.urls.some((url) => sameUrl(url, rawPage.finalUrl)) : null,
      sameTitleOnOtherRoute,
    });
    return {
      ok: true,
      ...evaluation,
      inputUrl: input.url?.trim() ?? prepared.url,
      finalUrl: rawPage.finalUrl,
      statusCode: rawPage.statusCode,
      responseMs: Date.now() - started,
      redirectCount: rawPage.redirectCount,
      renderMs: rendered.renderMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: error.message, hint: error.hint };
    throw error;
  }
}

async function readText(url: string) {
  try {
    await assertPublic(url);
    const response = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return "";
    return (await response.text()).slice(0, 400_000);
  } catch {
    return "";
  }
}

async function readSitemap(pageUrl: string) {
  const origin = originOf(pageUrl);
  const robots = await readText(`${origin}/robots.txt`);
  const declared = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((match) => match[1]).slice(0, 3);
  const seeds = declared.length > 0 ? declared : [`${origin}/sitemap.xml`];
  const urls: string[] = [];
  let found = false;
  for (const seed of seeds) {
    const xml = await readText(seed);
    if (!xml.includes("<loc>") && !xml.includes("<url>")) continue;
    found = true;
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => decode(match[1] || "")).filter(Boolean);
    const children = locs.filter((loc) => /sitemap/i.test(loc) && loc !== seed).slice(0, 2);
    urls.push(...locs.filter((loc) => !/sitemap/i.test(loc)));
    for (const child of children) {
      const nested = await readText(child);
      urls.push(...[...nested.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => decode(match[1] || "")));
    }
  }
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 200);
  const other = unique.find((url) => !sameUrl(url, pageUrl) && sameHost(url, pageUrl)) || "";
  return { found, urls: unique, otherUrl: other };
}

async function sharedTitle(pageUrl: string, title: string, otherUrl: string) {
  if (!otherUrl || !title) return null;
  try {
    const other = await fetchPage(otherUrl);
    const otherTitle = readSnapshot(other.html, other.finalUrl, other.statusCode).title;
    if (!otherTitle) return null;
    return otherTitle === title && !sameUrl(other.finalUrl, pageUrl);
  } catch {
    return null;
  }
}

function robotsDisallow(robots: string, assetUrl: string) {
  if (!robots.trim()) return false;
  let path = "/";
  try {
    path = new URL(assetUrl).pathname || "/";
  } catch {
    return false;
  }
  const groups = robots.split(/\n\s*\n/);
  const rules: { agent: string; disallow: string[] }[] = [];
  for (const group of groups) {
    const lines = group.split(/\n/).map((line) => line.replace(/#.*$/, "").trim()).filter(Boolean);
    const agents = lines.filter((line) => /^user-agent:/i.test(line)).map((line) => line.split(":").slice(1).join(":").trim().toLowerCase());
    const disallow = lines.filter((line) => /^disallow:/i.test(line)).map((line) => line.split(":").slice(1).join(":").trim());
    if (agents.length === 0) continue;
    rules.push({ agent: agents.join(" "), disallow });
  }
  const specific = rules.filter((rule) => rule.agent.includes("googlebot"));
  const chosen = specific.length > 0 ? specific : rules.filter((rule) => rule.agent.includes("*"));
  return chosen.some((rule) => rule.disallow.some((rulePath) => Boolean(rulePath) && (rulePath === "/" || path.startsWith(rulePath))));
}

function originOf(url: string) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function sameHost(left: string, right: string) {
  try {
    return new URL(left).hostname === new URL(right).hostname;
  } catch {
    return false;
  }
}

function sameUrl(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => value.replace(/\/+$/, "") || "/";
    return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "") && path(a.pathname) === path(b.pathname);
  } catch {
    return false;
  }
}

function decode(value: string) {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}
