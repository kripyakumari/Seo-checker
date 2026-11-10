import { cleanUrl, isTrackingKey, parseUrl, samePage } from "./parse";
import type { UrlCheck, UrlEvaluation, UrlParts, UrlTechnical } from "./types";

const HIGH_ERROR = -20;
const HIGH_WARN = -8;
const LOW_ERROR = -10;
const LOW_WARN = -4;

const WARN_CHARS = new Set(["!", ".", "'", "(", ")", "@", "$"]);
const ERROR_CHARS = new Set(["<", ">", '"', "{", "}", "|", "\\", "^", "`"]);
const SKIPPED = "Skipped. The URL could not be reached, so this technical check did not run.";

export function evaluateUrl(target: string, keyword: string, technical: UrlTechnical): UrlEvaluation {
  const parts = parseUrl(target);
  const checks = [
    descriptive(parts),
    urlLength(parts),
    slugLength(parts),
    repeated(parts),
    keywordInSlug(parts, keyword),
    separator(parts),
    lowercase(parts),
    special(parts),
    nonEnglish(parts),
    formatting(parts),
    dates(parts),
    depth(parts),
    parameters(parts, technical),
    hash(parts),
    status(technical),
    https(parts, technical),
    redirects(technical),
    canonical(parts, technical),
  ];
  const score = clamp(100 + checks.reduce((sum, check) => sum + check.points, 0));
  return { score, grade: gradeFor(score), checks, cleanUrl: cleanUrl(target), slug: parts.slug };
}

export function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function descriptive(parts: UrlParts): UrlCheck {
  const coded = parts.segments.filter(isCode);
  const queryId = parts.queryKeys.some((key) => /^(id|pid|item|product_id)$/i.test(key));
  if (coded.length || queryId) {
    const sample = coded[0] ? `/${coded[0]}` : `?${parts.queryKeys.find((key) => /^(id|pid|item|product_id)$/i.test(key))}=`;
    return row("descriptive-slug", "Descriptive slug", "Real words that describe the page", "error", `The path uses a code instead of words: ${sample}.`, "Replace the id or code with words that describe the page.", HIGH_ERROR, coded.join("\n"));
  }
  if (!parts.slug) return row("descriptive-slug", "Descriptive slug", "Real words that describe the page", "pass", "This URL has no page slug.", null, 0, "");
  return row("descriptive-slug", "Descriptive slug", "Real words that describe the page", "pass", "The slug uses words.", null, 0, "");
}

function urlLength(parts: UrlParts): UrlCheck {
  const length = parts.href.length;
  if (length > 200) return row("url-length", "URL length", "Under 100 characters", "error", `The full URL is ${length} characters, over 200.`, "Shorten the path and remove extra parameters.", LOW_ERROR, "");
  if (length >= 100) return row("url-length", "URL length", "Under 100 characters", "warning", `The full URL is ${length} characters.`, "Keep the full URL under 100 characters.", LOW_WARN, "");
  return row("url-length", "URL length", "Under 100 characters", "pass", `The full URL is ${length} characters.`, null, 0, "");
}

function slugLength(parts: UrlParts): UrlCheck {
  if (!parts.slug) return row("slug-length", "Slug length", "3–5 words", "pass", "This URL has no page slug.", null, 0, "");
  const count = parts.slugWords.length;
  if (count > 8) return row("slug-length", "Slug length", "3–5 words", "warning", `The slug has ${count} words.`, "Shorten the slug. Over 8 words is too long.", LOW_WARN, "");
  return row("slug-length", "Slug length", "3–5 words", "pass", `The slug has ${count} ${count === 1 ? "word" : "words"}.`, null, 0, "");
}

function repeated(parts: UrlParts): UrlCheck {
  const counts = new Map<string, number>();
  for (const word of parts.slugWords) counts.set(word, (counts.get(word) ?? 0) + 1);
  const doubles = [...counts.entries()].filter(([, count]) => count >= 2).map(([word]) => word);
  if (doubles.length) return row("repeated-words", "Repeated words", "Each word once in the slug", "warning", `The slug repeats: ${doubles.join(", ")}.`, "Keep each word once in the slug.", LOW_WARN, "");
  return row("repeated-words", "Repeated words", "Each word once in the slug", "pass", "Each slug word appears once.", null, 0, "");
}

function keywordInSlug(parts: UrlParts, keyword: string): UrlCheck {
  const focus = keyword.trim().toLowerCase();
  if (!focus) return row("keyword-in-slug", "Keyword in slug", "Keyword present in the slug", "info", "No focus keyword was entered, so this was skipped.", null, 0, "");
  const hyphenated = focus.replace(/\s+/g, "-");
  const flat = parts.slug.toLowerCase().replace(/[-_]+/g, " ");
  if (parts.slug.toLowerCase().includes(hyphenated) || flat.includes(focus)) {
    return row("keyword-in-slug", "Keyword in slug", "Keyword present in the slug", "pass", `The slug contains “${focus}”.`, null, 0, "");
  }
  return row("keyword-in-slug", "Keyword in slug", "Keyword present in the slug", "warning", `The slug does not contain “${focus}”.`, "Add the focus keyword to the slug when it still describes the page.", LOW_WARN, "");
}

function separator(parts: UrlParts): UrlCheck {
  const path = parts.decodedPath ?? parts.pathname;
  if (/\s|%20/i.test(parts.pathname) || /\s/.test(path)) {
    return row("word-separator", "Word separator", "Hyphens (-)", "error", "The path contains spaces.", "Replace each space with a hyphen.", HIGH_ERROR, "");
  }
  if (path.includes("_")) return row("word-separator", "Word separator", "Hyphens (-)", "warning", "The path uses underscores.", "Use hyphens between words.", HIGH_WARN, "");
  const joined = parts.segments.filter((segment) => /^[\p{L}]{18,}$/u.test(segment));
  if (joined.length) return row("word-separator", "Word separator", "Hyphens (-)", "warning", `Words look joined together: ${joined[0]}.`, "Separate the words with hyphens.", HIGH_WARN, "");
  return row("word-separator", "Word separator", "Hyphens (-)", "pass", "Words are separated with hyphens.", null, 0, "");
}

function lowercase(parts: UrlParts): UrlCheck {
  const path = parts.decodedPath ?? parts.pathname;
  if (/[\p{Lu}]/u.test(path)) return row("lowercase", "Lowercase", "All lowercase", "warning", "The path has an uppercase letter.", "Make the path lowercase.", LOW_WARN, "");
  return row("lowercase", "Lowercase", "All lowercase", "pass", "The path is lowercase.", null, 0, "");
}

function special(parts: UrlParts): UrlCheck {
  const path = parts.decodedPath ?? parts.pathname;
  const characters = [...path].filter((character) => character !== "/" && character !== " " && character !== "%" && !/[\p{L}\p{N}]/u.test(character) && character !== "-" && character !== "_");
  const errors = [...new Set(characters.filter((character) => ERROR_CHARS.has(character)))];
  if (errors.length) return row("special-characters", "Special characters", "Only letters, numbers, - and /", "error", `The path contains ${errors.join(" ")}.`, "Remove those characters from the path.", LOW_ERROR, "");
  const warnings = [...new Set(characters.filter((character) => WARN_CHARS.has(character) || !ERROR_CHARS.has(character)))];
  if (warnings.length) return row("special-characters", "Special characters", "Only letters, numbers, - and /", "warning", `The path contains ${warnings.join(" ")}.`, "Keep the path to letters, numbers, hyphens, and slashes.", LOW_WARN, "");
  return row("special-characters", "Special characters", "Only letters, numbers, - and /", "pass", "The path uses only letters, numbers, hyphens, and slashes.", null, 0, "");
}

function nonEnglish(parts: UrlParts): UrlCheck {
  if (parts.decodedPath == null || parts.doubleEncoded || parts.decodedPath.includes("\uFFFD")) {
    return row("non-english", "Non-English characters", "English slug, or correctly UTF-8 encoded", "warning", "The path has broken or double-encoded characters.", "Encode the path once as UTF-8.", LOW_WARN, "");
  }
  const letters = [...parts.decodedPath].filter((character) => /\p{L}/u.test(character));
  const hindi = letters.some((character) => /\p{Script=Devanagari}/u.test(character));
  if (hindi) return row("non-english", "Non-English characters", "English slug, or correctly UTF-8 encoded", "pass", "The Hindi letters are valid UTF-8.", null, 0, "");
  return row("non-english", "Non-English characters", "English slug, or correctly UTF-8 encoded", "pass", "The path encoding is intact.", null, 0, "");
}

function formatting(parts: UrlParts): UrlCheck {
  const path = parts.decodedPath ?? parts.pathname;
  const problems: string[] = [];
  if (parts.pathname.includes("//")) problems.push("a double slash");
  if (path.includes("--")) problems.push("a double hyphen");
  if (parts.segments.some((segment) => segment.startsWith("-") || segment.endsWith("-"))) problems.push("a hyphen at the start or end of a word");
  if (problems.length) return row("clean-formatting", "Clean formatting", "No // or --, no hyphen at the start or end of a word", "warning", `The path has ${problems.join(", ")}.`, "Use a single slash and a single hyphen between words.", LOW_WARN, "");
  return row("clean-formatting", "Clean formatting", "No // or --, no hyphen at the start or end of a word", "pass", "The path has no double slash, double hyphen, or dangling hyphen.", null, 0, "");
}

function dates(parts: UrlParts): UrlCheck {
  const dated = parts.segments.some((segment, index) => /^(19|20)\d{2}$/.test(segment) && /^(0?[1-9]|1[0-2])$/.test(parts.segments[index + 1] ?? ""));
  if (dated) return row("dates", "Dates in URL", "No date in the path", "info", "The path contains a date, such as /2024/05/.", "Dates are fine for news. Avoid them on a page that should stay current.", 0, "");
  return row("dates", "Dates in URL", "No date in the path", "pass", "The path has no date.", null, 0, "");
}

function depth(parts: UrlParts): UrlCheck {
  if (parts.folders >= 4) return row("folder-depth", "Folder depth", "3 folders or fewer", "warning", `The path has ${parts.folders} folders.`, "Keep the page within 3 folders.", LOW_WARN, "");
  return row("folder-depth", "Folder depth", "3 folders or fewer", "pass", `The path has ${parts.folders} ${parts.folders === 1 ? "folder" : "folders"}.`, null, 0, "");
}

function parameters(parts: UrlParts, technical: UrlTechnical): UrlCheck {
  const tracking = parts.queryKeys.filter(isTrackingKey);
  if (tracking.length === 0) return row("url-parameters", "URL parameters", "No ? parameters, or canonical points to the clean URL", "pass", "The URL has no tracking, session, sort, or filter parameters.", null, 0, "");
  const clean = cleanUrl(parts.href);
  if (technical.canonical && samePage(technical.canonical, clean)) {
    return row("url-parameters", "URL parameters", "No ? parameters, or canonical points to the clean URL", "pass", "Tracking parameters are present, and the canonical points to the clean URL.", null, 0, "");
  }
  return row("url-parameters", "URL parameters", "No ? parameters, or canonical points to the clean URL", "warning", `Tracking or filter parameters: ${tracking.join(", ")}.`, "Link to the clean URL, and point the canonical there.", HIGH_WARN, "");
}

function hash(parts: UrlParts): UrlCheck {
  if (parts.hash.startsWith("#/") || parts.hash.startsWith("#!")) {
    return row("hash-urls", "Hash (#) URLs", "No #/ or #! routing", "warning", `Content is loaded from ${parts.hash}.`, "Serve that page on a real path. A normal #section link can stay.", LOW_WARN, "");
  }
  return row("hash-urls", "Hash (#) URLs", "No #/ or #! routing", "pass", parts.hash ? "The hash is a normal section link." : "The URL has no hash.", null, 0, "");
}

function status(technical: UrlTechnical): UrlCheck {
  if (!technical.reached) return row("status-code", "Status code", "200", "error", "The URL could not be reached.", "Check the address and try again. String checks still ran.", HIGH_ERROR, "");
  if (technical.statusCode >= 400) return row("status-code", "Status code", "200", "error", `The page returned HTTP ${technical.statusCode}.`, "Publish the page so it returns HTTP 200.", HIGH_ERROR, "");
  if (technical.statusCode >= 300) return row("status-code", "Status code", "200", "error", `The URL stopped on HTTP ${technical.statusCode}.`, "Point the last redirect at a page that returns HTTP 200.", HIGH_ERROR, "");
  return row("status-code", "Status code", "200", "pass", `HTTP ${technical.statusCode}.`, null, 0, "");
}

function https(parts: UrlParts, technical: UrlTechnical): UrlCheck {
  if (!technical.reached) return skipped("https", "HTTPS", "https, and the http version 301-redirects to it");
  if (parts.protocol === "http:") return row("https", "HTTPS", "https, and the http version 301-redirects to it", "error", "The page loads on http.", "Serve the page on https and 301-redirect the http version to it.", HIGH_ERROR, "");
  if (technical.httpRedirectsToHttps === false) {
    return row("https", "HTTPS", "https, and the http version 301-redirects to it", "warning", "The page is https, but the http version does not 301-redirect to it.", "Add a 301 from the http URL to this https URL.", HIGH_WARN, "");
  }
  if (technical.httpRedirectsToHttps === true) {
    return row("https", "HTTPS", "https, and the http version 301-redirects to it", "pass", "The page is https, and the http version 301-redirects to it.", null, 0, "");
  }
  return row("https", "HTTPS", "https, and the http version 301-redirects to it", "pass", "The page is https.", null, 0, "");
}

function redirects(technical: UrlTechnical): UrlCheck {
  if (!technical.reached) return skipped("redirects", "Redirects", "No redirect, or 1 direct 301");
  const codes = technical.hops.slice(0, -1).map((hop) => hop.status);
  const temporary = codes.some((code) => code === 302 || code === 307);
  if (codes.length >= 2 || temporary) {
    const reason = temporary ? "A redirect uses 302 for the move." : `The URL redirects ${codes.length} times.`;
    return row("redirects", "Redirects", "No redirect, or 1 direct 301", "warning", reason, "Use one 301 redirect to the final URL.", HIGH_WARN, codes.join(" → "));
  }
  return row("redirects", "Redirects", "No redirect, or 1 direct 301", "pass", codes.length === 0 ? "The URL does not redirect." : "The URL uses one 301 redirect.", null, 0, "");
}

function canonical(parts: UrlParts, technical: UrlTechnical): UrlCheck {
  if (!technical.reached) return skipped("canonical", "Canonical", "Points to this URL");
  if (!technical.canonical) return row("canonical", "Canonical", "Points to this URL", "info", "The page has no canonical tag.", "Add a canonical that points to this URL.", 0, "");
  if (samePage(technical.canonical, parts.href)) return row("canonical", "Canonical", "Points to this URL", "pass", "The canonical points to this URL.", null, 0, "");
  return row("canonical", "Canonical", "Points to this URL", "warning", `The canonical points to ${technical.canonical}.`, "Point the canonical at this URL, or make this URL the one you want indexed.", HIGH_WARN, "");
}

function skipped(id: string, parameter: string, ideal: string): UrlCheck {
  return row(id, parameter, ideal, "info", SKIPPED, null, 0, "");
}

function isCode(segment: string) {
  return /^\d{3,}$/.test(segment) || /^[0-9a-f]{16,}$/i.test(segment) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || /^(item|product|p|pid|id|sku|post|page)[-_]?\d{3,}$/i.test(segment) || /^[a-z]+-\d{4,}$/i.test(segment);
}

function row(id: string, parameter: string, ideal: string, status: UrlCheck["status"], found: string, fix: string | null, points: number, details: string): UrlCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
