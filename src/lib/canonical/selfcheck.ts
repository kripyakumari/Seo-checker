import assert from "node:assert/strict";
import { evaluateCanonical } from "./checks";
import type { CanonicalProbe, CanonicalSource } from "./types";

const names = [
  "Canonical present",
  "Only one",
  "In the head",
  "Full URL",
  "https",
  "No #",
  "No tracking",
  "Canonical page opens",
  "No redirect",
  "Not noindex",
  "Not blocked",
  "Points to itself",
  "Same as sitemap",
  "Other versions",
];

function source(partial: Partial<CanonicalSource> = {}): CanonicalSource {
  return {
    raw: "https://example.com/page",
    resolved: "https://example.com/page",
    absolute: true,
    inHead: true,
    inBody: false,
    fromHeader: false,
    ...partial,
  };
}

function probe(partial: Partial<CanonicalProbe> = {}): CanonicalProbe {
  return {
    reached: true,
    statusCode: 200,
    finalUrl: "https://example.com/page",
    redirectCount: 0,
    noindex: false,
    selfCanonical: "https://example.com/page",
    robotsBlocked: false,
    ...partial,
  };
}

function status(
  id: string,
  sources: CanonicalSource[] = [source()],
  next: Partial<Parameters<typeof evaluateCanonical>[0]> = {},
) {
  return evaluateCanonical({
    pageUrl: "https://example.com/page",
    probe: probe(),
    sitemapNote: { status: "pass", found: "The sitemap lists the canonical URL.", fix: null, details: "" },
    otherVersions: [{ bad: false, detail: "http: ok" }],
    ...next,
    sources: next.sources ?? sources,
  }).checks.find((item) => item.id === id)?.status;
}

const good = evaluateCanonical({
  pageUrl: "https://example.com/page",
  sources: [source()],
  probe: probe(),
  sitemapNote: { status: "pass", found: "The sitemap lists the canonical URL.", fix: null, details: "" },
  otherVersions: [{ bad: false, detail: "http: ok" }],
});
assert.deepEqual(good.checks.map((item) => item.parameter), names);
assert.equal(good.checks.length, 14);
assert.equal(status("canonical-present"), "pass");
assert.equal(status("only-one"), "pass");
assert.equal(status("https"), "pass");

assert.equal(status("canonical-present", []), "warning");
assert.equal(status("only-one", [source(), source({ raw: "https://example.com/other", resolved: "https://example.com/other" })]), "error");
assert.equal(status("in-the-head", [source({ inHead: false, inBody: true })]), "error");
assert.equal(status("full-url", [source({ raw: "/page", absolute: false, resolved: "https://example.com/page" })]), "warning");
assert.equal(status("https", [source({ raw: "http://example.com/page", resolved: "http://example.com/page" })]), "error");
assert.equal(status("no-hash", [source({ raw: "https://example.com/page#section", resolved: "https://example.com/page#section" })]), "error");
assert.equal(status("no-tracking", [source({ raw: "https://example.com/page?utm_source=ads", resolved: "https://example.com/page?utm_source=ads" })]), "warning");
assert.equal(status("page-opens", [source()], { probe: probe({ statusCode: 404 }) }), "error");
assert.equal(status("no-redirect", [source()], { probe: probe({ redirectCount: 1, finalUrl: "https://example.com/final" }) }), "warning");
assert.equal(status("not-noindex", [source()], { probe: probe({ noindex: true }) }), "error");
assert.equal(status("not-blocked", [source()], { probe: probe({ robotsBlocked: true }) }), "error");
assert.equal(status("points-to-itself", [source({ resolved: "https://example.com/other", raw: "https://example.com/other" })]), "error");
assert.equal(status("other-versions", [source()], { otherVersions: [{ bad: true, detail: "www: loads" }] }), "warning");

console.log(`canonical selfcheck passed ${good.score} ${good.grade}`);
