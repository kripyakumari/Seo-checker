import { suggestedTag } from "./extract";
import type { CanonicalCheck, CanonicalEvaluation, CanonicalProbe, CanonicalSource } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;
const TRACKING = /^(utm_|gclid$|fbclid$|msclkid$|gbraid$|wbraid$|mc_eid$|session$|sessionid$|phpsessid$|jsessionid$|sid$)/i;

export function evaluateCanonical(input: {
  pageUrl: string;
  sources: CanonicalSource[];
  probe: CanonicalProbe | null;
  sitemapNote: { status: "pass" | "warning" | "info"; found: string; fix: string | null; details: string };
  otherVersions: { bad: boolean; detail: string }[];
}): CanonicalEvaluation {
  const sources = input.sources;
  const primary = sources[0] ?? null;
  const resolved = primary?.resolved ?? null;
  const checks: CanonicalCheck[] = [
    present(sources, input.pageUrl),
    onlyOne(sources),
    inTheHead(sources),
    fullUrl(primary),
    httpsCheck(primary),
    noHash(primary),
    noTracking(primary),
    pageOpens(primary, input.probe),
    noRedirect(primary, input.probe),
    notNoindex(primary, input.probe),
    notBlocked(primary, input.probe),
    pointsToItself(input.pageUrl, primary, input.probe),
    sameAsSitemap(input.sitemapNote),
    otherVersions(input.otherVersions, Boolean(primary)),
  ];

  let score = 100;
  for (const check of checks) score += check.points;
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: gradeFor(score),
    checks,
    suggestedTag: suggestedTag(resolved && isHttpUrl(resolved) ? resolved : input.pageUrl),
    canonicalUrl: resolved,
  };
}

function present(sources: CanonicalSource[], pageUrl: string): CanonicalCheck {
  if (sources.length > 0) {
    return row("canonical-present", "Canonical present", "Page has a canonical", "pass", "A canonical was found.", null, 0, sources.map(describe).join("\n"));
  }
  return row(
    "canonical-present",
    "Canonical present",
    "Page has a canonical",
    "warning",
    "No canonical tag or Link header was found.",
    `Add this tag in the head: ${suggestedTag(pageUrl)}`,
    WARNING_POINTS,
    "",
  );
}

function onlyOne(sources: CanonicalSource[]): CanonicalCheck {
  if (sources.length === 0) {
    return row("only-one", "Only one", "One canonical", "pass", "No canonical to duplicate.", null, 0, "");
  }
  const resolved = sources.map((item) => item.resolved).filter(Boolean) as string[];
  const unique = new Set(resolved.map(normalizeUrl));
  const header = sources.filter((item) => item.fromHeader);
  const html = sources.filter((item) => !item.fromHeader);
  const conflict = header.length > 0 && html.length > 0 && normalizeUrl(header[0].resolved || "") !== normalizeUrl(html[0].resolved || "");
  if (unique.size > 1 || conflict || html.length > 1) {
    return row(
      "only-one",
      "Only one",
      "One canonical",
      "error",
      conflict ? "The HTML tag and the Link header point to different URLs." : `${sources.length} canonical declarations were found.`,
      "Keep a single canonical URL in the head, and match the Link header if you send one.",
      ERROR_POINTS,
      sources.map(describe).join("\n"),
    );
  }
  return row("only-one", "Only one", "One canonical", "pass", "Exactly one canonical URL.", null, 0, "");
}

function inTheHead(sources: CanonicalSource[]): CanonicalCheck {
  const html = sources.filter((item) => !item.fromHeader);
  if (html.length === 0) {
    return row(
      "in-the-head",
      "In the head",
      "Inside <head>",
      sources.some((item) => item.fromHeader) ? "pass" : "pass",
      sources.some((item) => item.fromHeader) ? "Canonical came from the HTTP Link header." : "No HTML canonical tag to place.",
      null,
      0,
      "",
    );
  }
  if (html.some((item) => item.inBody && !item.inHead)) {
    return row("in-the-head", "In the head", "Inside <head>", "error", "A canonical tag sits in the body.", "Move rel=canonical into the document head.", ERROR_POINTS, "");
  }
  return row("in-the-head", "In the head", "Inside <head>", "pass", "The HTML canonical is in the head.", null, 0, "");
}

function fullUrl(primary: CanonicalSource | null): CanonicalCheck {
  if (!primary) return row("full-url", "Full URL", "https://site.com/page", "pass", "No canonical URL to check.", null, 0, "");
  if (!primary.absolute) {
    return row("full-url", "Full URL", "https://site.com/page", "warning", `Relative canonical: ${primary.raw}`, "Use a full absolute URL starting with https://.", WARNING_POINTS, "");
  }
  return row("full-url", "Full URL", "https://site.com/page", "pass", "The canonical is an absolute URL.", null, 0, primary.raw);
}

function httpsCheck(primary: CanonicalSource | null): CanonicalCheck {
  if (!primary?.resolved) return row("https", "https", "https://", "pass", "No canonical URL to check.", null, 0, "");
  if (primary.resolved.startsWith("http://")) {
    return row("https", "https", "https://", "error", "The canonical uses http://.", "Change the canonical to https://.", ERROR_POINTS, primary.resolved);
  }
  if (!primary.resolved.startsWith("https://")) {
    return row("https", "https", "https://", "error", "The canonical is not an https URL.", "Use an https:// canonical URL.", ERROR_POINTS, primary.resolved);
  }
  return row("https", "https", "https://", "pass", "The canonical uses https://.", null, 0, "");
}

function noHash(primary: CanonicalSource | null): CanonicalCheck {
  if (!primary) return row("no-hash", "No #", "Clean URL", "pass", "No canonical URL to check.", null, 0, "");
  try {
    const url = new URL(primary.resolved || primary.raw, "https://example.com");
    if (url.hash) {
      return row("no-hash", "No #", "Clean URL", "error", `The canonical has a fragment: ${url.hash}`, "Remove the # fragment from the canonical URL.", ERROR_POINTS, "");
    }
  } catch {
    /* ignore parse issues already covered elsewhere */
  }
  return row("no-hash", "No #", "Clean URL", "pass", "The canonical has no # fragment.", null, 0, "");
}

function noTracking(primary: CanonicalSource | null): CanonicalCheck {
  if (!primary?.resolved && !primary?.raw) return row("no-tracking", "No tracking", "Clean URL", "pass", "No canonical URL to check.", null, 0, "");
  try {
    const url = new URL(primary.resolved || primary.raw, "https://example.com");
    const tracking = [...url.searchParams.keys()].filter((key) => TRACKING.test(key));
    if (tracking.length > 0) {
      return row(
        "no-tracking",
        "No tracking",
        "Clean URL",
        "warning",
        `Tracking or session parameters: ${tracking.join(", ")}.`,
        "Point the canonical at the clean URL without utm or session parameters.",
        WARNING_POINTS,
        "",
      );
    }
  } catch {
    /* ignore */
  }
  return row("no-tracking", "No tracking", "Clean URL", "pass", "The canonical has no tracking parameters.", null, 0, "");
}

function pageOpens(primary: CanonicalSource | null, probe: CanonicalProbe | null): CanonicalCheck {
  if (!primary?.resolved) return row("page-opens", "Canonical page opens", "Status 200", "info", "Not checked, because no canonical URL was found.", null, 0, "");
  if (!probe || !probe.reached) {
    return row("page-opens", "Canonical page opens", "Status 200", "error", "The canonical URL could not be opened.", "Fix the canonical so it points at a live page.", ERROR_POINTS, "");
  }
  if (probe.statusCode >= 400) {
    return row("page-opens", "Canonical page opens", "Status 200", "error", `The canonical returned HTTP ${probe.statusCode}.`, "Point the canonical at a URL that returns HTTP 200.", ERROR_POINTS, "");
  }
  return row("page-opens", "Canonical page opens", "Status 200", "pass", `The canonical returned HTTP ${probe.statusCode}.`, null, 0, "");
}

function noRedirect(primary: CanonicalSource | null, probe: CanonicalProbe | null): CanonicalCheck {
  if (!primary?.resolved) return row("no-redirect", "No redirect", "Final URL", "info", "Not checked, because no canonical URL was found.", null, 0, "");
  if (!probe || !probe.reached) return row("no-redirect", "No redirect", "Final URL", "info", "Not checked, because the canonical URL did not open.", null, 0, "");
  if (probe.redirectCount > 0 || !samePage(probe.finalUrl, primary.resolved)) {
    return row(
      "no-redirect",
      "No redirect",
      "Final URL",
      "warning",
      `The canonical redirects to ${probe.finalUrl}.`,
      "Point the canonical directly at the final URL.",
      WARNING_POINTS,
      `${probe.redirectCount} redirect${probe.redirectCount === 1 ? "" : "s"}`,
    );
  }
  return row("no-redirect", "No redirect", "Final URL", "pass", "The canonical does not redirect.", null, 0, "");
}

function notNoindex(primary: CanonicalSource | null, probe: CanonicalProbe | null): CanonicalCheck {
  if (!primary?.resolved) return row("not-noindex", "Not noindex", "Indexable", "info", "Not checked, because no canonical URL was found.", null, 0, "");
  if (!probe || !probe.reached) return row("not-noindex", "Not noindex", "Indexable", "info", "Not checked, because the canonical URL did not open.", null, 0, "");
  if (probe.noindex) {
    return row("not-noindex", "Not noindex", "Indexable", "error", "The canonical page has noindex.", "Remove noindex from the canonical page, or point at an indexable URL.", ERROR_POINTS, "");
  }
  return row("not-noindex", "Not noindex", "Indexable", "pass", "The canonical page is not noindex.", null, 0, "");
}

function notBlocked(primary: CanonicalSource | null, probe: CanonicalProbe | null): CanonicalCheck {
  if (!primary?.resolved) return row("not-blocked", "Not blocked", "Allowed in robots.txt", "info", "Not checked, because no canonical URL was found.", null, 0, "");
  if (!probe || probe.robotsBlocked == null) {
    return row("not-blocked", "Not blocked", "Allowed in robots.txt", "info", "robots.txt could not be read, or was empty.", null, 0, "");
  }
  if (probe.robotsBlocked) {
    return row("not-blocked", "Not blocked", "Allowed in robots.txt", "error", "robots.txt blocks the canonical URL.", "Allow the canonical path in robots.txt.", ERROR_POINTS, "");
  }
  return row("not-blocked", "Not blocked", "Allowed in robots.txt", "pass", "robots.txt allows the canonical URL.", null, 0, "");
}

function pointsToItself(pageUrl: string, primary: CanonicalSource | null, probe: CanonicalProbe | null): CanonicalCheck {
  if (!primary?.resolved) {
    return row("points-to-itself", "Points to itself", "Canonical page names itself", "info", "Not checked, because no canonical URL was found.", null, 0, "");
  }
  if (samePage(pageUrl, primary.resolved)) {
    return row("points-to-itself", "Points to itself", "Canonical page names itself", "pass", "The canonical points at this page.", null, 0, "");
  }
  if (probe?.selfCanonical && !samePage(probe.selfCanonical, primary.resolved) && !samePage(probe.selfCanonical, probe.finalUrl)) {
    return row(
      "points-to-itself",
      "Points to itself",
      "Canonical page names itself",
      "error",
      "The canonical points at another page that itself canonicalises elsewhere (chain).",
      "Point every page in the set at one final canonical URL.",
      ERROR_POINTS,
      `This page → ${primary.resolved} → ${probe.selfCanonical}`,
    );
  }
  return row(
    "points-to-itself",
    "Points to itself",
    "Canonical page names itself",
    "error",
    `The canonical points at another page: ${primary.resolved}.`,
    "Use a self-referencing canonical, or make that other URL the one you open in the checker.",
    ERROR_POINTS,
    "",
  );
}

function sameAsSitemap(note: { status: "pass" | "warning" | "info"; found: string; fix: string | null; details: string }): CanonicalCheck {
  return row("same-as-sitemap", "Same as sitemap", "Sitemap lists the canonical URL", note.status, note.found, note.fix, note.status === "warning" ? WARNING_POINTS : 0, note.details);
}

function otherVersions(versions: { bad: boolean; detail: string }[], hasCanonical: boolean): CanonicalCheck {
  if (!hasCanonical) {
    return row("other-versions", "Other versions", "http, www and trailing slash redirect to it", "info", "Not checked, because no canonical URL was found.", null, 0, "");
  }
  if (versions.length === 0) {
    return row("other-versions", "Other versions", "http, www and trailing slash redirect to it", "info", "No alternate versions were probed.", null, 0, "");
  }
  const bad = versions.filter((item) => item.bad);
  if (bad.length > 0) {
    return row(
      "other-versions",
      "Other versions",
      "http, www and trailing slash redirect to it",
      "warning",
      `${bad.length} alternate ${bad.length === 1 ? "version loads" : "versions load"} as a separate page.`,
      "301-redirect http, www, and trailing-slash variants to the canonical URL.",
      WARNING_POINTS,
      bad.map((item) => item.detail).join("\n"),
    );
  }
  return row("other-versions", "Other versions", "http, www and trailing slash redirect to it", "pass", "Alternate versions redirect or point here.", null, 0, versions.map((item) => item.detail).join("\n"));
}

function describe(source: CanonicalSource) {
  const where = source.fromHeader ? "Link header" : source.inBody && !source.inHead ? "body" : "head";
  return `${where}: ${source.raw}`;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return value;
  }
}

function samePage(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => (value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value);
    return a.protocol === b.protocol && a.host.toLowerCase() === b.host.toLowerCase() && path(a.pathname) === path(b.pathname) && a.search === b.search;
  } catch {
    return false;
  }
}

function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function row(
  id: string,
  parameter: string,
  ideal: string,
  status: CanonicalCheck["status"],
  found: string,
  fix: string | null,
  points: number,
  details: string,
): CanonicalCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}
