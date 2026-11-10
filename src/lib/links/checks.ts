import type { CheckStatus, CrawledPage, FoundLink, LinkCheck, LinkEvaluation, LinkMode, SiteCrawl, TargetProbe } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;

export function evaluateLinks(input: {
  links: FoundLink[];
  probes: TargetProbe[];
  keyword: string;
  mode: LinkMode;
  site: SiteCrawl | null;
  targetsChecked: number;
  targetsTotal: number;
  uncrawlable: string[];
}): LinkEvaluation {
  const links = input.links;
  const body = links.filter((link) => link.place === "body");
  const checks: LinkCheck[] = [];

  checks.push(crawlable(input.uncrawlable));

  const vague = links.filter((link) => link.vague);
  checks.push(
    vague.length
      ? row("descriptive-anchor", "Descriptive anchor", "Describes the target page", "warning", `${vague.length} ${vague.length === 1 ? "anchor is" : "anchors are"} “click here”, “read more”, “learn more”, or “this”.`, "Replace that anchor with words that describe the page it opens.", WARNING_POINTS, list(vague))
      : row("descriptive-anchor", "Descriptive anchor", "Describes the target page", "pass", "No anchor is “click here”, “read more”, “learn more”, or “this”.", null, 0, ""),
  );

  const empty = links.filter((link) => link.empty);
  checks.push(
    empty.length
      ? row("empty-anchor", "Empty anchor", "Text, or image with alt text", "error", `${empty.length} ${empty.length === 1 ? "link has" : "links have"} no text and no image alt.`, "Add anchor text, or an alt on the linked image.", ERROR_POINTS, list(empty))
      : row("empty-anchor", "Empty anchor", "Text, or image with alt text", "pass", "Every internal link has text or image alt text.", null, 0, ""),
  );

  const mixed = sameTextDifferentTargets(links);
  checks.push(
    mixed.length
      ? row("same-anchor", "Same anchor, different pages", "One anchor text → one target", "warning", "The same anchor text points to 2 or more pages.", "Use one anchor text for one target.", WARNING_POINTS, mixed.join("\n"))
      : row("same-anchor", "Same anchor, different pages", "One anchor text → one target", "pass", "Each anchor text points to one target.", null, 0, ""),
  );

  checks.push(overOptimised(links, input.keyword));
  checks.push(contextual(links));
  checks.push(deepLinks(links));

  checks.push(
    body.length === 0
      ? row("body-links", "Internal links in body", "At least 1", "warning", "The body has no internal link.", "Add at least one internal link in the body text.", WARNING_POINTS, "")
      : row("body-links", "Internal links in body", "At least 1", "pass", `${body.length} internal ${body.length === 1 ? "link" : "links"} in the body.`, null, 0, ""),
  );
  checks.push(broken(input.probes, input.targetsChecked, input.targetsTotal));
  checks.push(redirected(input.probes));
  checks.push(flag(links, "nofollow", "Nofollow", "Internal links followed", (link) => link.nofollow, "warning", "rel=\"nofollow\" is set on an internal link.", "Remove nofollow from internal links so they pass equity.", WARNING_POINTS));
  checks.push(flag(links, "https", "HTTPS", "Internal links use https", (link) => link.insecure, "warning", "An internal link uses http://.", "Point internal links at the https URL.", WARNING_POINTS));
  checks.push(flag(links, "parameters", "Parameters", "Clean URLs", (link) => link.parameterized, "warning", "A link contains a tracking, session, or sort parameter.", "Link to the clean URL, without utm, session, or sort parameters.", WARNING_POINTS));
  checks.push(noindex(input.probes));
  checks.push(orphans(input.mode, input.site));
  checks.push(clickDepth(input.mode, input.site));
  checks.push(hierarchy(input.mode, input.site));

  return {
    score: clamp(100 + checks.reduce((sum, item) => sum + item.points, 0)),
    grade: gradeFor(clamp(100 + checks.reduce((sum, item) => sum + item.points, 0))),
    linkCount: links.length,
    bodyCount: body.length,
    checks,
  };
}

export function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function crawlable(uncrawlable: string[]): LinkCheck {
  if (uncrawlable.length === 0) {
    return row("crawlable", "Crawlable links", "An <a> with a real href", "pass", "Every internal link is an <a> with a real address Google can request.", null, 0, "");
  }
  const count = uncrawlable.length;
  return row(
    "crawlable",
    "Crawlable links",
    "An <a> with a real href",
    "error",
    `${count} internal ${count === 1 ? "link is" : "links are"} not a normal <a href>, so Google may not crawl ${count === 1 ? "it" : "them"}.`,
    "Replace each one with an <a> whose href is the real page URL.",
    ERROR_POINTS,
    uncrawlable.slice(0, 12).join("\n"),
  );
}

function overOptimised(links: FoundLink[], keyword: string): LinkCheck {
  if (!keyword) {
    return row("over-optimised", "Over-optimised anchors", "Natural variety", "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  const text = links.filter((link) => link.text);
  const exact = text.filter((link) => plain(link.text) === plain(keyword));
  if (text.length >= 3 && exact.length / text.length >= 0.8) {
    return row("over-optimised", "Over-optimised anchors", "Natural variety", "warning", `The exact keyword is the anchor on ${exact.length} of ${text.length} internal links.`, "Keep the keyword on the links that match it. Vary the other anchors.", WARNING_POINTS, list(exact));
  }
  return row("over-optimised", "Over-optimised anchors", "Natural variety", "pass", "The exact keyword is not the anchor on almost every internal link.", null, 0, "");
}

function contextual(links: FoundLink[]): LinkCheck {
  if (links.length === 0) {
    return row("contextual", "Contextual links", "Links inside body text", "pass", "There are no internal links parked only in the menu, sidebar, or footer.", null, 0, "");
  }
  const body = links.filter((link) => link.place === "body");
  if (body.length === 0) {
    return row("contextual", "Contextual links", "Links inside body text", "warning", "Internal links appear only in the menu, sidebar, or footer.", "Add at least one internal link inside the body text.", WARNING_POINTS, "");
  }
  return row("contextual", "Contextual links", "Links inside body text", "pass", "At least one internal link sits in the body text.", null, 0, "");
}

function deepLinks(links: FoundLink[]): LinkCheck {
  if (links.length === 0) {
    return row("deep-links", "Deep links", "Links to inner pages", "pass", "There are no internal links that stop at the home or category level.", null, 0, "");
  }
  const deep = links.filter((link) => !link.shallow);
  if (deep.length === 0) {
    return row("deep-links", "Deep links", "Links to inner pages", "warning", "Internal links go only to the home page or a one-level category page.", "Link to an inner page, such as a post or product, from this page.", WARNING_POINTS, "");
  }
  return row("deep-links", "Deep links", "Links to inner pages", "pass", "At least one internal link points at an inner page.", null, 0, "");
}

function broken(probes: TargetProbe[], checked: number, total: number): LinkCheck {
  const bad = probes.filter((probe) => probe.status !== null && probe.status >= 400);
  const cap = total > checked ? ` Checked ${checked} of ${total} targets.` : "";
  if (bad.length) {
    return row("broken", "Broken links", "All return 200", "error", `${bad.length} internal ${bad.length === 1 ? "target returned" : "targets returned"} HTTP 4xx or 5xx.${cap}`, "Point the link at a URL that returns HTTP 200.", ERROR_POINTS, bad.map((probe) => `${probe.url} — HTTP ${probe.status}`).join("\n"));
  }
  const unread = probes.filter((probe) => probe.error);
  if (unread.length) {
    return row("broken", "Broken links", "All return 200", "info", `${unread.length} ${unread.length === 1 ? "target could" : "targets could"} not be read, so ${unread.length === 1 ? "it was" : "they were"} not marked broken.${cap}`, null, 0, unread.map((probe) => `${probe.url} — ${probe.error}`).join("\n"));
  }
  return row("broken", "Broken links", "All return 200", "pass", probes.length === 0 ? "No internal targets to fetch." : `Fetched targets returned HTTP 200.${cap}`, null, 0, "");
}

function redirected(probes: TargetProbe[]): LinkCheck {
  const hops = probes.filter((probe) => probe.redirects > 0 && (probe.status === null || probe.status < 400));
  if (hops.length === 0) {
    return row("redirected", "Redirected links", "Point to the final URL", "pass", "Internal links point at URLs that do not redirect.", null, 0, "");
  }
  return row("redirected", "Redirected links", "Point to the final URL", "warning", `${hops.length} internal ${hops.length === 1 ? "link points" : "links point"} at a redirected URL.`, "Update the link to the final URL.", WARNING_POINTS, hops.map((probe) => `${probe.url} → ${probe.finalUrl}`).join("\n"));
}

function noindex(probes: TargetProbe[]): LinkCheck {
  const blocked = probes.filter((probe) => probe.noindex || probe.canonicalElsewhere);
  if (blocked.length === 0) {
    return row("noindex", "Links to noindex", "Links point to indexable pages", "pass", "Fetched targets are not noindex, and are not canonicalised elsewhere.", null, 0, "");
  }
  return row("noindex", "Links to noindex", "Links point to indexable pages", "warning", `${blocked.length} ${blocked.length === 1 ? "target is" : "targets are"} noindex or canonicalised elsewhere.`, "Link to the indexable URL, not a noindex or canonicalised page.", WARNING_POINTS, blocked.map((probe) => `${probe.url}${probe.noindex ? " — noindex" : " — canonical points elsewhere"}`).join("\n"));
}

function orphans(mode: LinkMode, site: SiteCrawl | null): LinkCheck {
  if (mode !== "site") {
    return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "info", "Whole site mode is off, so orphan pages were not scored.", null, 0, "This row does not lower the score.");
  }
  if (!site) {
    return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "info", "The site crawl did not finish, so orphan pages were not scored.", null, 0, "This row does not lower the score.");
  }
  if (site.capped) {
    return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "info", "The crawl stopped at the page limit, so orphan pages were not scored.", null, 0, "This row does not lower the score.");
  }
  if (site.sitemapUrls.length === 0) {
    return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "info", "No sitemap was found, so pages with zero links in could not be listed.", null, 0, "");
  }
  if (site.pages.length < 2) {
    return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "pass", "Only one page was crawled, so nothing else can be an orphan.", null, 0, "");
  }
  const incoming = inCounts(site.pages);
  const orphaned = site.sitemapUrls.filter((url) => (incoming.get(url) ?? 0) === 0);
  if (orphaned.length === 0) {
    return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "pass", "Every sitemap URL has an internal link pointing to it.", null, 0, "");
  }
  return row("orphans", "Orphan pages", "Every page has 1+ internal link in", "error", `${orphaned.length} sitemap ${orphaned.length === 1 ? "page has" : "pages have"} no internal link pointing to ${orphaned.length === 1 ? "it" : "them"}.`, "Add an internal link to each orphan from a related page.", ERROR_POINTS, orphaned.slice(0, 12).join("\n"));
}

function clickDepth(mode: LinkMode, site: SiteCrawl | null): LinkCheck {
  if (mode !== "site") {
    return row("click-depth", "Click depth", "Important pages within 3 clicks of home", "info", "Whole site mode is off, so click depth was not scored.", null, 0, "This row does not lower the score.");
  }
  if (!site) {
    return row("click-depth", "Click depth", "Important pages within 3 clicks of home", "info", "The site crawl did not finish, so click depth was not scored.", null, 0, "This row does not lower the score.");
  }
  if (!site.homeFetched) {
    return row("click-depth", "Click depth", "Important pages within 3 clicks of home", "info", "Home could not be fetched, so click depth was not scored.", null, 0, "");
  }
  const deep = site.pages.filter((page) => page.depth >= 4);
  if (deep.length === 0) {
    return row("click-depth", "Click depth", "Important pages within 3 clicks of home", "pass", "No crawled page is 4 or more clicks from home.", null, 0, "");
  }
  return row("click-depth", "Click depth", "Important pages within 3 clicks of home", "warning", `${deep.length} crawled ${deep.length === 1 ? "page is" : "pages are"} 4 or more clicks from home.`, "Link to that page from somewhere closer to home.", WARNING_POINTS, deep.map((page) => `${page.url} — ${page.depth} clicks`).join("\n"));
}

function hierarchy(mode: LinkMode, site: SiteCrawl | null): LinkCheck {
  if (mode !== "site") {
    return row("link-hierarchy", "Link hierarchy", "Key pages get the most internal links", "info", "Whole site mode is off, so link hierarchy was not scored.", null, 0, "This row does not lower the score.");
  }
  if (!site) {
    return row("link-hierarchy", "Link hierarchy", "Key pages get the most internal links", "info", "The site crawl did not finish, so link hierarchy was not scored.", null, 0, "This row does not lower the score.");
  }
  if (!site.homeFetched) {
    return row("link-hierarchy", "Link hierarchy", "Key pages get the most internal links", "info", "Home could not be fetched, so link hierarchy was not scored.", null, 0, "");
  }
  const incoming = inCounts(site.pages);
  const key = site.pages.filter((page) => page.depth <= 1);
  const minor = site.pages.filter((page) => page.depth >= 2);
  const weakKey = key.filter((page) => minor.some((other) => (incoming.get(other.url) ?? 0) > (incoming.get(page.url) ?? 0)));
  if (minor.length === 0 || weakKey.length === 0) {
    return row("link-hierarchy", "Link hierarchy", "Key pages get the most internal links", "pass", "No key page has fewer internal links than a deeper page.", null, 0, "");
  }
  return row("link-hierarchy", "Link hierarchy", "Key pages get the most internal links", "warning", "A key page has fewer internal links than a deeper page.", "Add internal links to the key page from related pages.", WARNING_POINTS, weakKey.map((page) => page.url).join("\n"));
}

function inCounts(pages: CrawledPage[]) {
  const counts = new Map<string, number>();
  for (const page of pages) counts.set(page.url, 0);
  for (const page of pages) {
    for (const target of new Set(page.out)) {
      if (counts.has(target) && target !== page.url) counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

function sameTextDifferentTargets(links: FoundLink[]) {
  const groups = new Map<string, Set<string>>();
  for (const link of links) {
    const key = plain(link.text);
    if (!key) continue;
    const set = groups.get(key) ?? new Set<string>();
    set.add(link.href);
    groups.set(key, set);
  }
  return [...groups.entries()].filter(([, targets]) => targets.size >= 2).map(([text, targets]) => `${text} → ${[...targets].join(", ")}`);
}

function flag(
  links: FoundLink[],
  id: string,
  parameter: string,
  ideal: string,
  test: (link: FoundLink) => boolean,
  status: CheckStatus,
  found: string,
  fix: string,
  points: number,
): LinkCheck {
  const hits = links.filter(test);
  if (hits.length === 0) return row(id, parameter, ideal, "pass", `No internal link fails ${parameter.toLowerCase()}.`, null, 0, "");
  return row(id, parameter, ideal, status, found, fix, points, list(hits));
}

function list(links: FoundLink[]) {
  return links.slice(0, 8).map((link) => `${link.text || "(empty anchor)"} — ${link.href}`).join("\n");
}

function plain(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function row(
  id: string,
  parameter: string,
  ideal: string,
  status: CheckStatus,
  found: string,
  fix: string | null,
  points: number,
  details: string,
): LinkCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}

function clamp(score: number) {
  return Math.min(100, Math.max(0, score));
}
