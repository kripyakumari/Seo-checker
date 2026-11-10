import assert from "node:assert/strict";
import { evaluateJavascript, type JavascriptEvidence } from "./checks";
import type { JsSnapshot } from "./types";

function snapshot(partial: Partial<JsSnapshot> = {}): JsSnapshot {
  return {
    statusCode: 200,
    finalUrl: "https://example.com/pricing",
    title: "Pricing",
    description: "Plans and prices.",
    canonical: "https://example.com/pricing",
    robots: "index,follow",
    h1: ["Pricing"],
    text: "Pricing starts at 20 for the team plan. Compare what is included.",
    wordCount: 40,
    prices: ["20"],
    internalLinks: ["https://example.com/pricing", "https://example.com/about"],
    realLinks: 2,
    weakLinks: 0,
    jsonLd: [{ valid: true, text: "{\"@type\":\"Product\"}" }],
    images: [{ src: "/hero.jpg", loading: "lazy", dataSrc: false }],
    scripts: ["https://example.com/app.js"],
    stylesheets: ["https://example.com/app.css"],
    emptyRoot: false,
    ...partial,
  };
}

const names = [
  "Rendering type",
  "Critical content",
  "Progressive enhancement",
  "Internal links",
  "History API",
  "Meta tags",
  "Structured data",
  "Lazy loading",
  "JS errors",
  "Blocked JS/CSS",
  "JS weight",
  "Sitemap",
  "Prerendering",
  "Output",
];

function evidence(partial: Partial<JavascriptEvidence> = {}): JavascriptEvidence {
  const raw = partial.raw ?? snapshot();
  return {
    raw,
    rendered: partial.rendered === undefined ? snapshot() : partial.rendered,
    renderMs: 900,
    consoleErrors: [],
    failedAssets: [],
    robotsBlocked: [],
    scriptBytes: 120_000,
    renderError: "",
    sitemapFound: true,
    sitemapListed: true,
    sameTitleOnOtherRoute: false,
    ...partial,
  };
}

function status(id: string, subject = evidence()) {
  return evaluateJavascript(subject).checks.find((item) => item.id === id)?.status;
}

const good = evaluateJavascript(evidence());
assert.deepEqual(
  good.checks.map((item) => item.parameter),
  names,
);
assert.equal(good.rendering, "ssr");
assert.equal(status("rendering-type"), "pass");
assert.equal(status("critical-content"), "pass");
assert.equal(status("progressive"), "pass");
assert.equal(status("internal-links"), "pass");
assert.equal(status("history-api"), "pass");
assert.equal(status("meta-tags"), "pass");
assert.equal(status("structured-data"), "pass");
assert.equal(status("lazy-loading"), "pass");
assert.equal(status("js-errors"), "pass");
assert.equal(status("blocked-files"), "pass");
assert.equal(status("prerendering"), "pass");
assert.equal(status("output"), "info");

const shell = snapshot({
  title: "",
  description: "",
  canonical: "",
  robots: "",
  h1: [],
  text: "",
  wordCount: 0,
  prices: [],
  internalLinks: [],
  jsonLd: [],
  images: [],
  emptyRoot: true,
});
const rendered = snapshot({ wordCount: 80, h1: ["Pricing"], text: "Pricing starts at 20 after the app boots and shows the plans." });
const csr = evaluateJavascript(evidence({ raw: shell, rendered, sitemapListed: false }));
assert.equal(csr.rendering, "csr");
assert.equal(status("rendering-type", evidence({ raw: shell, rendered })), "error");
assert.equal(status("critical-content", evidence({ raw: shell, rendered })), "error");
assert.equal(status("prerendering", evidence({ raw: shell, rendered })), "error");
assert.equal(status("history-api", evidence({ raw: snapshot({ finalUrl: "https://example.com/#/pricing" }), rendered: snapshot({ finalUrl: "https://example.com/#/pricing" }) })), "error");
assert.equal(status("structured-data", evidence({ raw: snapshot({ jsonLd: [] }), rendered: snapshot({ jsonLd: [{ valid: true, text: "{}" }] }) })), "warning");
assert.equal(status("lazy-loading", evidence({ raw: snapshot({ images: [{ src: "", loading: "", dataSrc: true }] }) })), "warning");
assert.equal(status("blocked-files", evidence({ robotsBlocked: ["https://example.com/app.js"] })), "error");
assert.equal(status("js-errors", evidence({ consoleErrors: ["boom"] })), "warning");
assert.equal(status("sitemap", evidence({ sitemapFound: false })), "warning");

const translated = snapshot({
  wordCount: 140,
  text: `${snapshot().text} هذا النطاق مخصص للاستخدام في أمثلة التوثيق دون الحاجة إلى إذن وهذه ليست خدمة`,
});
const staticPage = evaluateJavascript(evidence({ raw: snapshot({ wordCount: 25 }), rendered: translated }));
assert.equal(staticPage.rendering, "ssr");
assert.equal(status("critical-content", evidence({ raw: snapshot({ wordCount: 25 }), rendered: translated })), "pass");
assert.equal(status("rendering-type", evidence({ raw: snapshot({ wordCount: 25 }), rendered: translated })), "pass");

console.log(`javascript selfcheck passed ${good.score} ${good.grade} csr ${csr.score}`);
