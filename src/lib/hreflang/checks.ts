import { classifyCode } from "./codes";
import { CMS_STEPS, renderHeader, renderHtml, renderXml } from "./output";
import { absoluteUrl, isFullUrl, sameUrl } from "./parse";
import type { HreflangCheck, HreflangEdge, HreflangEvaluation, HreflangLink, PageEvidence } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;

export function evaluateHreflang(pages: PageEvidence[]): HreflangEvaluation {
  const source = pages[0];
  const declared = source ? declaredLinks(source) : [];
  const checks: HreflangCheck[] = [
    languageCode(pages),
    countryCode(pages),
    fullUrl(pages),
    selfReference(pages),
    returnLinks(pages),
    xDefault(pages),
    duplicates(pages),
    pageOpens(pages),
    canonical(pages),
    indexable(pages),
    oneMethod(pages),
    outputRow(declared, source?.url || ""),
    bulkRow(pages),
  ];
  let score = 100;
  for (const check of checks) score += check.points;
  score = Math.max(0, Math.min(100, score));
  const opened = pages.filter((page) => page.opened).length;
  return {
    score,
    grade: gradeFor(score),
    checks,
    edges: buildEdges(pages),
    html: renderHtml(declared, source?.url || ""),
    xml: renderXml(declared, source?.url || ""),
    header: renderHeader(declared, source?.url || ""),
    opened,
    declared: uniqueTargets(pages).length,
  };
}

function languageCode(pages: PageEvidence[]): HreflangCheck {
  const codes = uniqueCodes(pages);
  const bad = codes.filter((code) => classifyCode(code) === "bad-language" || classifyCode(code) === "empty");
  if (bad.length === 0) {
    return row("language-code", "Language code", "Valid ISO code (en, hi, fr)", "pass", codes.length === 0 ? "No language code was declared." : "Every hreflang language code is a valid ISO code.", null, 0, "");
  }
  return row(
    "language-code",
    "Language code",
    "Valid ISO code (en, hi, fr)",
    "error",
    `Wrong language code: ${bad.join(", ")}.`,
    "Use a two-letter ISO 639-1 code such as en, hi, or fr. A region, when you need one, comes after it: en-GB.",
    ERROR_POINTS,
    bad.join("\n"),
  );
}

function countryCode(pages: PageEvidence[]): HreflangCheck {
  const bad = uniqueCodes(pages).filter((code) => {
    const kind = classifyCode(code);
    return kind === "bad-region" || kind === "country-only";
  });
  if (bad.length === 0) {
    return row("country-code", "Country code", "Valid code after language (en-GB, hi-IN)", "pass", "Region codes sit after a language, and each region is a valid country code.", null, 0, "");
  }
  return row(
    "country-code",
    "Country code",
    "Valid code after language (en-GB, hi-IN)",
    "error",
    `Country code problem: ${bad.join(", ")}.`,
    "Write the language first, then a real country code: en-GB or hi-IN. en-UK is not valid (use GB). A country alone, such as in, is not a hreflang.",
    ERROR_POINTS,
    bad.join("\n"),
  );
}

function fullUrl(pages: PageEvidence[]): HreflangCheck {
  const relative = allLinks(pages).filter((link) => !isFullUrl(link.href));
  if (relative.length === 0) {
    return row("full-url", "Full URL", "https://site.com/page", "pass", "Every hreflang href is a full http or https URL.", null, 0, "");
  }
  const sample = relative.slice(0, 6).map((link) => `${link.code} → ${link.href}`);
  return row(
    "full-url",
    "Full URL",
    "https://site.com/page",
    "error",
    `${relative.length} hreflang href${relative.length === 1 ? " is" : "s are"} relative.`,
    "Use the full URL, including https and the host. A path such as /page is not valid in hreflang.",
    ERROR_POINTS,
    sample.join("\n"),
  );
}

function selfReference(pages: PageEvidence[]): HreflangCheck {
  const missing = pages.filter((page) => page.opened && page.statusCode === 200 && !lists(page, page.url));
  if (missing.length === 0) {
    return row("self-reference", "Self-reference", "Each page lists itself", "pass", "Each opened page includes its own URL in the hreflang set.", null, 0, "");
  }
  return row(
    "self-reference",
    "Self-reference",
    "Each page lists itself",
    "error",
    missing.some((page) => declaredLinks(page).length === 0)
      ? "A page does not list itself. No hreflang alternate points at that page."
      : "A page lists other versions but omits its own URL.",
    "Add a hreflang for the page itself, with its full URL, on every version. " + CMS_STEPS,
    ERROR_POINTS,
    missing.map((page) => page.url).slice(0, 8).join("\n"),
  );
}

function returnLinks(pages: PageEvidence[]): HreflangCheck {
  const oneWay = buildEdges(pages).filter((edge) => !edge.back && !sameUrl(edge.from, edge.to));
  if (oneWay.length === 0) {
    return row("return-links", "Return links", "If A links to B, B links back to A", "pass", "Every alternate that could be opened links back.", null, 0, "");
  }
  return row(
    "return-links",
    "Return links",
    "If A links to B, B links back to A",
    "error",
    `${oneWay.length} alternate${oneWay.length === 1 ? " is" : "s are"} one-way.`,
    "When page A points at page B, page B must point back at A with the matching hreflang. Put the same set of tags on every version.",
    ERROR_POINTS,
    oneWay.slice(0, 8).map((edge) => `${edge.code}: ${edge.from} → ${edge.to}`).join("\n"),
  );
}

function xDefault(pages: PageEvidence[]): HreflangCheck {
  const opened = pages.filter((page) => page.opened && page.statusCode === 200);
  const missing = opened.filter((page) => !declaredLinks(page).some((link) => link.code.toLowerCase() === "x-default"));
  const targets = new Set(opened.flatMap((page) => declaredLinks(page).filter((link) => link.code.toLowerCase() === "x-default").map((link) => absoluteUrl(link.href, page.url))).filter(Boolean));
  if (opened.length === 0) {
    return row("x-default", "x-default", "One fallback page set", "warning", "No page could be opened, so the x-default fallback was not confirmed.", "Add one x-default alternate that points at the fallback URL.", WARNING_POINTS, "");
  }
  if (missing.length > 0) {
    return row("x-default", "x-default", "One fallback page set", "warning", "A page is missing the x-default fallback.", "Add one x-default link on every version, all pointing at the same fallback URL.", WARNING_POINTS, missing.map((page) => page.url).slice(0, 6).join("\n"));
  }
  if (targets.size > 1) {
    return row("x-default", "x-default", "One fallback page set", "warning", "x-default points at more than one URL.", "Choose one fallback URL and use it for every x-default.", WARNING_POINTS, [...targets].slice(0, 6).join("\n"));
  }
  return row("x-default", "x-default", "One fallback page set", "pass", "One x-default fallback is set.", null, 0, [...targets][0] || "");
}

function duplicates(pages: PageEvidence[]): HreflangCheck {
  const problems: string[] = [];
  for (const page of pages.filter((item) => item.opened)) {
    const links = declaredLinks(page);
    const codes = new Map<string, number>();
    const urls = new Map<string, string[]>();
    for (const link of links) {
      const code = link.code.trim().toLowerCase();
      codes.set(code, (codes.get(code) || 0) + 1);
      const href = absoluteUrl(link.href, page.url);
      if (!href || code === "x-default") continue;
      const bucket = urls.get(href) || [];
      bucket.push(link.code);
      urls.set(href, bucket);
    }
    for (const [code, count] of codes) {
      if (count > 1) problems.push(`${page.url} uses ${code} ${count} times`);
    }
    for (const [href, codesForUrl] of urls) {
      const unique = new Set(codesForUrl.map((code) => code.toLowerCase()));
      if (unique.size > 1) problems.push(`${href} is used for ${[...unique].join(" and ")}`);
    }
  }
  if (problems.length === 0) {
    return row("duplicates", "Duplicates", "Each code and URL used once", "pass", "Each hreflang code and each language URL is used once.", null, 0, "");
  }
  return row("duplicates", "Duplicates", "Each code and URL used once", "error", "The same code or the same language URL is used twice.", "Keep one hreflang per language, and do not point two languages at the same URL. x-default may reuse the fallback URL.", ERROR_POINTS, problems.slice(0, 8).join("\n"));
}

function pageOpens(pages: PageEvidence[]): HreflangCheck {
  const closed = pages.filter((page) => page.opened && (page.fetchError || page.statusCode !== 200 || page.redirectedTo));
  if (closed.length === 0) {
    return row("page-opens", "Page opens", "200", "pass", "Every opened version returned HTTP 200 without a redirect.", null, 0, "");
  }
  return row(
    "page-opens",
    "Page opens",
    "200",
    "error",
    `${closed.length} version${closed.length === 1 ? "" : "s"} did not return 200.`,
    "Each hreflang URL must return HTTP 200. Do not point hreflang at a 404, a 500, or a redirect.",
    ERROR_POINTS,
    closed.slice(0, 8).map((page) => `${page.url} · ${page.fetchError || (page.redirectedTo ? `redirect to ${page.redirectedTo}` : `HTTP ${page.statusCode}`)}`).join("\n"),
  );
}

function canonical(pages: PageEvidence[]): HreflangCheck {
  const wrong = pages.filter((page) => page.opened && page.statusCode === 200 && page.canonical && !sameUrl(page.canonical, page.url));
  if (wrong.length === 0) {
    return row("canonical", "Canonical", "Each version is canonical to itself", "pass", "Each opened version is canonical to its own URL, or has no canonical.", null, 0, "");
  }
  return row(
    "canonical",
    "Canonical",
    "Each version is canonical to itself",
    "error",
    "A version's canonical points at a different URL.",
    "The canonical on each language URL must be that same URL, not another language.",
    ERROR_POINTS,
    wrong.slice(0, 8).map((page) => `${page.url} → ${page.canonical}`).join("\n"),
  );
}

function indexable(pages: PageEvidence[]): HreflangCheck {
  const blocked = pages.filter((page) => page.opened && page.statusCode === 200 && (page.noindex || page.robotsBlocked));
  if (blocked.length === 0) {
    return row("indexable", "Indexable", "No noindex, not blocked in robots.txt", "pass", "Opened versions are indexable.", null, 0, "");
  }
  return row(
    "indexable",
    "Indexable",
    "No noindex, not blocked in robots.txt",
    "error",
    "A version is noindex or blocked in robots.txt.",
    "Remove noindex and allow the URL in robots.txt. A hreflang target has to be a page Google can index.",
    ERROR_POINTS,
    blocked.slice(0, 8).map((page) => `${page.url} · ${page.noindex ? "noindex" : "robots.txt"}`).join("\n"),
  );
}

function oneMethod(pages: PageEvidence[]): HreflangCheck {
  const clashes: string[] = [];
  for (const page of pages.filter((item) => item.opened && item.statusCode === 200)) {
    const sets = [
      page.htmlLinks.length ? ["HTML tags", signature(page.htmlLinks, page.url)] : null,
      page.headerLinks.length ? ["HTTP header", signature(page.headerLinks, page.url)] : null,
      page.sitemapLinks.length ? ["sitemap", signature(page.sitemapLinks, page.url)] : null,
    ].filter((item): item is [string, string] => Boolean(item));
    for (let i = 0; i < sets.length; i += 1) {
      for (let j = i + 1; j < sets.length; j += 1) {
        if (sets[i][1] !== sets[j][1]) clashes.push(`${page.url}: ${sets[i][0]} and ${sets[j][0]} disagree`);
      }
    }
  }
  if (clashes.length === 0) {
    return row("one-method", "One method", "Tags, sitemap or header, used consistently", "pass", "The page does not publish two hreflang methods that disagree.", null, 0, "");
  }
  return row("one-method", "One method", "Tags, sitemap or header, used consistently", "warning", "HTML tags, the HTTP header, or the sitemap do not list the same alternates.", "Use one method, or make the tags, the Link header, and the sitemap list the same codes and URLs.", WARNING_POINTS, clashes.slice(0, 6).join("\n"));
}

function outputRow(links: HreflangLink[], base: string): HreflangCheck {
  const html = renderHtml(links, base);
  if (!html) {
    return row("output", "Output", "HTML tags, XML sitemap, HTTP header", "info", "There is no hreflang set to copy yet.", CMS_STEPS, 0, "");
  }
  return row("output", "Output", "HTML tags, XML sitemap, HTTP header", "info", "HTML tags, an XML sitemap, and an HTTP Link header are ready to copy.", CMS_STEPS, 0, html);
}

function bulkRow(pages: PageEvidence[]): HreflangCheck {
  const opened = pages.filter((page) => page.opened).length;
  const waiting = pages.filter((page) => !page.opened).length;
  const note = waiting > 0 ? ` Opened ${opened}. ${waiting} more stayed in the list and were not fetched.` : ` Opened ${opened} version${opened === 1 ? "" : "s"}.`;
  return row("bulk", "Bulk", "Pattern, CSV or sitemap; 100 URLs free", "info", `Pattern, CSV, and sitemap input cover up to 100 URLs.${note}`, null, 0, "");
}

export function buildEdges(pages: PageEvidence[]): HreflangEdge[] {
  const edges: HreflangEdge[] = [];
  for (const page of pages.filter((item) => item.opened && item.statusCode === 200)) {
    for (const link of declaredLinks(page)) {
      const to = absoluteUrl(link.href, page.url);
      if (!to) continue;
      const target = pages.find((item) => sameUrl(item.url, to));
      const confirmed = Boolean(target && target.opened && target.statusCode === 200 && !target.redirectedTo && !target.fetchError);
      const back = !confirmed || lists(target as PageEvidence, page.url) || sameUrl(page.url, to);
      edges.push({ from: page.url, to, code: link.code, back });
    }
  }
  return edges;
}

function declaredLinks(page: PageEvidence) {
  if (page.htmlLinks.length > 0) return page.htmlLinks;
  if (page.headerLinks.length > 0) return page.headerLinks;
  return page.sitemapLinks;
}

function lists(page: PageEvidence, url: string) {
  return declaredLinks(page).some((link) => {
    const href = absoluteUrl(link.href, page.url);
    return href && sameUrl(href, url);
  });
}

function allLinks(pages: PageEvidence[]) {
  return pages.flatMap((page) => [...page.htmlLinks, ...page.headerLinks, ...page.sitemapLinks]);
}

function uniqueCodes(pages: PageEvidence[]) {
  return [...new Set(allLinks(pages).map((link) => link.code.trim()).filter(Boolean))];
}

function uniqueTargets(pages: PageEvidence[]) {
  const urls = new Set<string>();
  for (const page of pages) {
    for (const link of declaredLinks(page)) {
      const href = absoluteUrl(link.href, page.url);
      if (href) urls.add(href);
    }
  }
  return [...urls];
}

function signature(links: HreflangLink[], base: string) {
  return links
    .map((link) => `${link.code.trim().toLowerCase()} ${absoluteUrl(link.href, base) || link.href}`)
    .sort()
    .join("\n");
}

function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function row(id: string, parameter: string, ideal: string, status: HreflangCheck["status"], found: string, fix: string | null, points: number, details: string): HreflangCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}
