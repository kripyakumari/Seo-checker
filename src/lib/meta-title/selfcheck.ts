import assert from "node:assert/strict";
import { evaluateTitle } from "./checks";
import { extractTitleData } from "./extract";
import { isPrivateAddress } from "./network";
import { measurePixels } from "./pixels";
import { brandFromUrl, prepareUrl } from "./url";

function checkMap(title: string, extra: Partial<Parameters<typeof evaluateTitle>[0]> = {}) {
  const result = evaluateTitle({
    title,
    titleCount: 1,
    h1: extra.h1 === undefined ? `${title} notes` : extra.h1,
    h1Count: 1,
    ogTitle: extra.ogTitle === undefined ? title : extra.ogTitle,
    keyword: extra.keyword ?? "",
    brand: extra.brand ?? "",
    ...extra,
  });
  return {
    result,
    get(id: string) {
      const found = result.checks.find((check) => check.id === id);
      assert.ok(found, `missing check ${id}`);
      return found;
    },
  };
}

const homePx = measurePixels("Home");
assert.equal(homePx.width, 53, "Home should measure 53px in Arial 20px");

const wide = "W".repeat(50);
const widePx = measurePixels(wide);
assert.ok(widePx.width > 620, `expected wide title, got ${widePx.width}`);
assert.ok(widePx.desktopCut < wide.length);
assert.ok(measurePixels(wide.slice(0, widePx.desktopCut)).width <= 580);

const home = checkMap("Home", { h1: null, h1Count: 0, ogTitle: null });
assert.equal(home.get("titlePresent").status, "pass");
assert.equal(home.get("characterLength").status, "error");
assert.equal(home.get("characterLength").points, -20);
assert.equal(home.get("desktopPixels").status, "pass");
assert.equal(home.get("titleVsOg").status, "warning");
assert.equal(home.result.checks.some((check) => check.id.startsWith("keyword")), false);
assert.equal(home.result.checks.some((check) => ["titleVsH1", "year", "powerWord"].includes(check.id)), false);
assert.equal(home.result.score, 74, JSON.stringify(home.result.checks.filter((c) => c.points)));

const blank = checkMap("", { titleCount: 0, h1: null, h1Count: 0, ogTitle: null });
assert.equal(blank.get("titlePresent").status, "error");
assert.equal(blank.get("titleCount").status, "error");
assert.equal(blank.result.score, 20);

const goodTitle = "Local plumbing costs for older city homes | Hartwell";
assert.equal([...goodTitle].length, 52);
const good = checkMap(goodTitle, {
  brand: "Hartwell",
  h1: "What older city homes pay for plumbing",
});
assert.equal(good.get("characterLength").status, "pass");
assert.equal(good.get("desktopPixels").status, "pass", `width ${good.result.measurements.desktopPx}`);
assert.equal(good.get("mobilePixels").status, "pass");
assert.equal(good.get("brandPosition").status, "pass");
assert.equal(good.get("titleVsOg").status, "pass");
assert.equal(good.result.score, 100, JSON.stringify(good.result.checks.filter((c) => c.points)));

const domainBrand = checkMap(goodTitle, { brand: "hartwell", h1: "What older city homes pay for plumbing" });
assert.equal(domainBrand.get("brandPosition").status, "pass");
assert.match(domainBrand.get("brandPosition").found, /from the domain/);

const hyphenBrand = checkMap("Local plumbing costs for older city homes | My Brand", {
  brand: "my-brand",
  h1: "Plumbing costs in older city homes",
});
assert.equal(hyphenBrand.get("brandPosition").status, "pass");

assert.equal(brandFromUrl("https://www.biztalbox.com/services"), "biztalbox");
assert.equal(brandFromUrl("https://blog.example.co.uk/post"), "example");
assert.equal(brandFromUrl("https://en.wikipedia.org/wiki/SEO"), "wikipedia");

const brandedStart = checkMap("Hartwell | Local plumbing costs for city homes", {
  brand: "Hartwell",
  h1: "Local plumbing costs for city homes",
});
assert.equal(brandedStart.get("brandPosition").status, "pass");

const brandedMiddle = checkMap("Local Hartwell plumbing costs for city homes", {
  brand: "Hartwell",
  h1: "Local plumbing costs for city homes",
});
assert.equal(brandedMiddle.get("brandPosition").status, "warning");

const shouted = checkMap("FREE local plumbing costs for older city homes", {
  h1: "Local plumbing costs for older city homes",
});
assert.equal(shouted.get("allCaps").status, "warning");

const emoji = checkMap("Local plumbing costs for older city homes today 🔥", {
  h1: "Older city homes and their plumbing costs",
});
assert.equal(emoji.get("emoji").status, "warning");

const mixed = checkMap("Local plumbing costs - older city homes | Hartwell", {
  brand: "Hartwell",
  h1: "Plumbing costs in older city homes",
});
assert.equal(mixed.get("separators").status, "warning");

const hyphenated = checkMap("Well-known plumbing costs for older city homes | Hartwell", {
  brand: "Hartwell",
  h1: "Plumbing costs in older city homes",
});
assert.equal(hyphenated.get("separators").status, "pass", hyphenated.get("separators").found);

const twoTitles = checkMap(goodTitle, { titleCount: 2, brand: "Hartwell", h1: "What older city homes pay for plumbing" });
assert.equal(twoTitles.get("titleCount").status, "error");
assert.equal(twoTitles.result.score, 82);

const wideEval = checkMap(wide, { h1: `${wide} notes`, ogTitle: wide });
assert.equal(wideEval.get("desktopPixels").status, "error");
assert.equal(wideEval.get("mobilePixels").status, "warning");
assert.equal(wideEval.get("allCaps").status, "warning");
assert.equal(wideEval.get("characterLength").status, "pass");
assert.equal(wideEval.result.score, 75, JSON.stringify(wideEval.result.checks.filter((c) => c.points)));

assert.equal(wideEval.result.topIssues.length, 3);
assert.equal(wideEval.result.topIssues[0]?.id, "desktopPixels");

const extracted = extractTitleData(`<!doctype html><html><head>
<title>Fish &amp; Chips | Northline</title>
<title>Second</title>
<meta property="og:title" content="Fish &amp; Chips | Northline">
<meta name="description" content="A plate of fish.">
</head><body>
<svg><title>Icon</title></svg>
<h1>How we cook <b>fish</b> and chips</h1>
</body></html>`);
assert.equal(extracted.titles.length, 2);
assert.equal(extracted.title, "Fish & Chips | Northline");
assert.equal(extracted.h1, "How we cook fish and chips");
assert.equal(extracted.ogTitle, "Fish & Chips | Northline");
assert.equal(extracted.metaDescription, "A plate of fish.");
assert.equal(extracted.challenge, false);

const prepared = prepareUrl("  Example.COM/docs#top ");
assert.equal(prepared.ok && prepared.url, "https://example.com/docs");
assert.equal(prepareUrl("javascript:alert(1)").ok, false);
assert.equal(prepareUrl("http://127.0.0.1/admin").ok, false);
assert.equal(prepareUrl("http://localhost/admin").ok, false);
assert.equal(prepareUrl("example .com").ok, false);
assert.equal(prepareUrl("https://user:pass@example.com").ok, false);
assert.equal(isPrivateAddress("10.1.2.3"), true);
assert.equal(isPrivateAddress("8.8.8.8"), false);
assert.equal(isPrivateAddress("::1"), true);
assert.equal(isPrivateAddress("2001:4860:4860::8888"), false);

console.log("meta title selfcheck passed");
