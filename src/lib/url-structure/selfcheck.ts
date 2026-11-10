import assert from "node:assert/strict";
import { evaluateUrl } from "./checks";
import { cleanUrl } from "./parse";
import type { UrlTechnical } from "./types";

const names = [
  "Descriptive slug",
  "URL length",
  "Slug length",
  "Repeated words",
  "Keyword in slug",
  "Word separator",
  "Lowercase",
  "Special characters",
  "Non-English characters",
  "Clean formatting",
  "Dates in URL",
  "Folder depth",
  "URL parameters",
  "Hash (#) URLs",
  "Status code",
  "HTTPS",
  "Redirects",
  "Canonical",
  "Duplicate versions",
];

function live(url: string, extra: Partial<UrlTechnical> = {}): UrlTechnical {
  return {
    reached: true,
    hops: [{ url, status: 200 }],
    statusCode: 200,
    canonical: url,
    httpRedirectsToHttps: true,
    duplicates: [],
    ...extra,
  };
}

function status(url: string, id: string, technical = live(url), keyword = "") {
  return evaluateUrl(url, keyword, technical).checks.find((item) => item.id === id)?.status;
}

const good = "https://example.com/running-shoes-guide";
const goodResult = evaluateUrl(good, "running shoes", live(good));
assert.deepEqual(goodResult.checks.map((item) => item.parameter), names);
assert.equal(goodResult.checks.length, 19);
assert.equal(goodResult.grade, "Excellent");
assert.equal(status(good, "descriptive-slug"), "pass");
assert.equal(status(good, "keyword-in-slug", live(good), ""), "info");
assert.equal(status(good, "keyword-in-slug", live(good), "running shoes"), "pass");
assert.equal(cleanUrl("https://Example.com/Running_Shoes/?utm_source=ads#section"), "https://example.com/running-shoes#section");

assert.equal(status("https://example.com/item-48213", "descriptive-slug"), "error");
assert.equal(status("https://example.com/p?id=8472", "descriptive-slug"), "error");
assert.equal(status(`https://example.com/${"word-".repeat(40)}page`, "url-length"), "error");
assert.equal(status("https://example.com/one-two-three-four-five-six-seven-eight-nine", "slug-length"), "warning");
assert.equal(status("https://example.com/running-shoes-shoes", "repeated-words"), "warning");
assert.equal(status("https://example.com/blue-shoes", "keyword-in-slug", live("https://example.com/blue-shoes"), "running shoes"), "warning");
assert.equal(status("https://example.com/running_shoes", "word-separator"), "warning");
assert.equal(status("https://example.com/running%20shoes", "word-separator"), "error");
assert.equal(status("https://example.com/Running-Shoes", "lowercase"), "warning");
assert.equal(status("https://example.com/running-shoes!", "special-characters"), "warning");
assert.equal(status("https://example.com/running<shoes", "special-characters"), "error");
assert.equal(status("https://example.com/running--shoes", "clean-formatting"), "warning");
assert.equal(status("https://example.com/blog/2024/05/story", "dates"), "info");
assert.equal(status("https://example.com/a/b/c/d/page", "folder-depth"), "warning");
assert.equal(status("https://example.com/a/b/c/page", "folder-depth"), "pass");
assert.equal(status("https://example.com/shoes?utm_source=ads", "url-parameters", live("https://example.com/shoes?utm_source=ads", { canonical: null })), "warning");
assert.equal(status("https://example.com/shoes#/services", "hash-urls"), "warning");
assert.equal(status("https://example.com/shoes#reviews", "hash-urls"), "pass");

const missing = "https://example.com/shoes";
assert.equal(status(missing, "status-code", live(missing, { reached: false, statusCode: 0, hops: [], httpRedirectsToHttps: null })), "error");
assert.equal(status(missing, "canonical", live(missing, { reached: false, statusCode: 0, hops: [] })), "info");
assert.equal(status("http://example.com/shoes", "https", live("http://example.com/shoes")), "error");
assert.equal(status(good, "redirects", live(good, { hops: [{ url: "https://example.com/old", status: 302 }, { url: good, status: 200 }] })), "warning");
assert.equal(status(good, "redirects", live(good, { hops: [{ url: "https://example.com/old", status: 301 }, { url: good, status: 200 }] })), "pass");
assert.equal(status(good, "canonical", live(good, { canonical: "https://example.com/other" })), "warning");
assert.equal(status(good, "canonical", live(good, { canonical: null })), "info");
assert.equal(status(good, "duplicate-versions", live(good, { duplicates: [{ label: "www", bad: true, detail: "returns 200" }] })), "warning");
assert.equal(status(good, "non-english", live("https://example.com/%E0%A4%B9%E0%A4%BF")), "pass");

console.log(`url structure selfcheck passed ${goodResult.score} ${goodResult.grade}`);
