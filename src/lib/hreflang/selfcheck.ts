import assert from "node:assert/strict";
import { evaluateHreflang } from "./checks";
import { classifyCode } from "./codes";
import type { HreflangLink, PageEvidence } from "./types";

function page(url: string, links: HreflangLink[], partial: Partial<PageEvidence> = {}): PageEvidence {
  return {
    url,
    statusCode: 200,
    redirectedTo: "",
    canonical: url,
    noindex: false,
    robotsBlocked: false,
    htmlLinks: links,
    headerLinks: [],
    sitemapLinks: [],
    fetchError: "",
    opened: true,
    ...partial,
  };
}

const pair: HreflangLink[] = [
  { code: "en", href: "https://example.com/en" },
  { code: "hi-IN", href: "https://example.com/hi" },
  { code: "x-default", href: "https://example.com/en" },
];

function status(id: string, pages: PageEvidence[]) {
  return evaluateHreflang(pages).checks.find((item) => item.id === id)?.status;
}

const good = evaluateHreflang([
  page("https://example.com/en", pair),
  page("https://example.com/hi", pair),
]);
assert.equal(good.score, 100);
assert.equal(good.grade, "Excellent");
assert.equal(status("language-code", [page("https://example.com/en", pair), page("https://example.com/hi", pair)]), "pass");
assert.equal(status("self-reference", [page("https://example.com/en", pair), page("https://example.com/hi", pair)]), "pass");
assert.equal(status("return-links", [page("https://example.com/en", pair), page("https://example.com/hi", pair)]), "pass");
assert.equal(status("x-default", [page("https://example.com/en", pair), page("https://example.com/hi", pair)]), "pass");
assert.equal(status("output", [page("https://example.com/en", pair)]), "info");
assert.equal(status("bulk", [page("https://example.com/en", pair)]), "info");

assert.equal(classifyCode("en-UK"), "bad-region");
assert.equal(classifyCode("in"), "country-only");
assert.equal(classifyCode("en"), "language");
assert.equal(classifyCode("hi-IN"), "language-region");
assert.equal(status("country-code", [page("https://example.com/en", [{ code: "en-UK", href: "https://example.com/en" }])]), "error");
assert.equal(status("country-code", [page("https://example.com/en", [{ code: "in", href: "https://example.com/in" }])]), "error");
assert.equal(status("language-code", [page("https://example.com/en", [{ code: "english", href: "https://example.com/en" }])]), "error");
assert.equal(status("full-url", [page("https://example.com/en", [{ code: "fr", href: "/fr" }])]), "error");
assert.equal(status("self-reference", [page("https://example.com/en", [{ code: "fr", href: "https://example.com/fr" }])]), "error");
assert.equal(
  status("return-links", [
    page("https://example.com/en", [
      { code: "en", href: "https://example.com/en" },
      { code: "fr", href: "https://example.com/fr" },
    ]),
    page("https://example.com/fr", [{ code: "fr", href: "https://example.com/fr" }]),
  ]),
  "error",
);
assert.equal(status("x-default", [page("https://example.com/en", [{ code: "en", href: "https://example.com/en" }])]), "warning");
assert.equal(
  status("duplicates", [
    page("https://example.com/en", [
      { code: "en", href: "https://example.com/en" },
      { code: "en", href: "https://example.com/en-us" },
    ]),
  ]),
  "error",
);
assert.equal(status("page-opens", [page("https://example.com/missing", [], { statusCode: 404 })]), "error");
assert.equal(status("page-opens", [page("https://example.com/en", pair, { redirectedTo: "https://example.com/en/" })]), "error");
assert.equal(status("canonical", [page("https://example.com/fr", pair, { canonical: "https://example.com/en" })]), "error");
assert.equal(status("indexable", [page("https://example.com/en", pair, { noindex: true })]), "error");
assert.equal(
  status("one-method", [
    page("https://example.com/en", pair, {
      headerLinks: [{ code: "en", href: "https://example.com/en" }],
    }),
  ]),
  "warning",
);
assert.equal(status("self-reference", [page("https://example.com/en", [])]), "error");

console.log(`hreflang selfcheck passed ${good.score} ${good.grade}`);
