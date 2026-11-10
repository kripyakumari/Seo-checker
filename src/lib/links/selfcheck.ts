import assert from "node:assert/strict";
import { evaluateLinks } from "./checks";
import { extractInternalLinks } from "./extract";
import type { FoundLink, SiteCrawl, TargetProbe } from "./types";

function link(partial: Partial<FoundLink> & Pick<FoundLink, "href" | "text">): FoundLink {
  return {
    empty: !partial.text,
    vague: false,
    nofollow: false,
    insecure: false,
    parameterized: false,
    self: false,
    place: "body",
    shallow: false,
    ...partial,
  };
}

function probe(partial: Partial<TargetProbe> & Pick<TargetProbe, "url">): TargetProbe {
  return {
    status: 200,
    redirects: 0,
    finalUrl: partial.url,
    noindex: false,
    canonicalElsewhere: false,
    error: null,
    ...partial,
  };
}

function run(links: FoundLink[], extra: Partial<Parameters<typeof evaluateLinks>[0]> = {}) {
  return evaluateLinks({
    links,
    probes: extra.probes ?? links.filter((item) => !item.self).map((item) => probe({ url: item.href })),
    keyword: extra.keyword ?? "",
    mode: extra.mode ?? "page",
    site: extra.site ?? null,
    targetsChecked: extra.targetsChecked ?? links.length,
    targetsTotal: extra.targetsTotal ?? links.length,
    uncrawlable: extra.uncrawlable ?? [],
  });
}

function status(result: ReturnType<typeof run>, id: string) {
  return result.checks.find((item) => item.id === id)?.status;
}

const good = run([link({ href: "https://example.com/blog/pipes", text: "Pipe repair costs" })]);
assert.equal(good.score, 100);
assert.equal(good.grade, "Excellent");
assert.equal(status(good, "body-links"), "pass");
assert.equal(status(good, "orphans"), "info");
assert.equal(status(good, "crawlable"), "pass");
assert.equal(good.checks.length, 17);

const empty = run([link({ href: "https://example.com/blog/pipes", text: "", empty: true })]);
assert.equal(status(empty, "empty-anchor"), "error");
assert.equal(empty.score, 80);

const vague = run([link({ href: "https://example.com/blog/pipes", text: "Click here", vague: true })]);
assert.equal(status(vague, "descriptive-anchor"), "warning");

const hidden = run([link({ href: "https://example.com/blog/pipes", text: "Pipe repair costs" })], { uncrawlable: ["Products — /products"] });
assert.equal(status(hidden, "crawlable"), "error");
assert.equal(hidden.score, 80);

const pricing = run([link({ href: "https://example.com/pricing", text: "Pricing", shallow: true })]);
assert.equal(status(pricing, "descriptive-anchor"), "pass");
assert.equal(status(pricing, "deep-links"), "warning");

const mixed = run([
  link({ href: "https://example.com/a", text: "Services" }),
  link({ href: "https://example.com/b", text: "Services" }),
]);
assert.equal(status(mixed, "same-anchor"), "warning");

const stuffed = run(
  [
    link({ href: "https://example.com/a", text: "plumbing" }),
    link({ href: "https://example.com/b", text: "plumbing" }),
    link({ href: "https://example.com/c", text: "plumbing" }),
  ],
  { keyword: "plumbing" },
);
assert.equal(status(stuffed, "over-optimised"), "warning");
assert.equal(status(run([link({ href: "https://example.com/a", text: "plumbing" })]), "over-optimised"), "info");

const navOnly = run([link({ href: "https://example.com/blog/pipes", text: "Pipe repair costs", place: "nav" })]);
assert.equal(status(navOnly, "contextual"), "warning");
assert.equal(status(navOnly, "body-links"), "warning");

const broken = run([link({ href: "https://example.com/missing", text: "Missing page" })], {
  probes: [probe({ url: "https://example.com/missing", status: 404 })],
});
assert.equal(status(broken, "broken"), "error");

const unread = run([link({ href: "https://example.com/slow", text: "Slow page" })], {
  probes: [probe({ url: "https://example.com/slow", status: null, error: "The target could not be read." })],
});
assert.equal(status(unread, "broken"), "info");
assert.equal(unread.checks.find((item) => item.id === "broken")?.points, 0);

const hop = run([link({ href: "https://example.com/old", text: "Old page" })], {
  probes: [probe({ url: "https://example.com/old", redirects: 1, finalUrl: "https://example.com/new" })],
});
assert.equal(status(hop, "redirected"), "warning");

assert.equal(status(run([link({ href: "https://example.com/a", text: "Guide", nofollow: true })]), "nofollow"), "warning");
assert.equal(status(run([link({ href: "http://example.com/a", text: "Guide", insecure: true })]), "https"), "warning");
assert.equal(status(run([link({ href: "https://example.com/a?utm_source=nav", text: "Guide", parameterized: true })]), "parameters"), "warning");
assert.equal(status(run([link({ href: "https://example.com/a", text: "Guide" })], { probes: [probe({ url: "https://example.com/a", noindex: true })] }), "noindex"), "warning");

const thin = run([]);
assert.equal(status(thin, "body-links"), "warning");

const site: SiteCrawl = {
  pages: [
    { url: "https://example.com", depth: 0, out: ["https://example.com/blog"] },
    { url: "https://example.com/blog", depth: 1, out: ["https://example.com/blog/pipes"] },
    { url: "https://example.com/blog/pipes", depth: 2, out: ["https://example.com"] },
    { url: "https://example.com/blog/deep/one", depth: 4, out: [] },
  ],
  capped: false,
  homeFetched: true,
  sitemapUrls: ["https://example.com", "https://example.com/blog", "https://example.com/orphan"],
};
const crawled = run([link({ href: "https://example.com/blog/pipes", text: "Pipe repair costs" })], { mode: "site", site });
assert.equal(status(crawled, "orphans"), "error");
assert.equal(status(crawled, "click-depth"), "warning");
assert.equal(status(crawled, "link-hierarchy"), "pass");

const html = `<!doctype html><body>
<nav><a href="/">Home</a></nav>
<p><a href="/blog/pipe-repairs">Pipe repair costs</a> <a href="https://iana.org/x">Away</a></p>
<footer><a href="/blog/pipe-repairs"><img alt=""></a></footer>
</body>`;
const extracted = extractInternalLinks(html, "https://example.com/services");
assert.equal(extracted.links.length, 3);
assert.equal(extracted.links[0]?.place, "nav");
assert.equal(extracted.links[1]?.place, "body");
assert.equal(extracted.links[1]?.shallow, false);
assert.equal(extracted.links[2]?.empty, true);
assert.equal(extracted.links[2]?.place, "footer");
assert.equal(extracted.uncrawlable.length, 0);

const hiddenHtml = `<body>
<a href="javascript:goTo('products')">Products</a>
<a href="javascript:void(0)">Menu</a>
<a href="/blog/pipe-repairs">Pipe repair costs</a>
<a href="/pricing">Click here to learn more</a>
<span href="/about">About</span>
<span href="https://iana.org/x">Away</span>
</body>`;
const hiddenExtracted = extractInternalLinks(hiddenHtml, "https://example.com/services");
assert.equal(hiddenExtracted.links.length, 2);
assert.equal(hiddenExtracted.links[1]?.vague, true);
assert.deepEqual(hiddenExtracted.uncrawlable, ["Products — products", "About — /about"]);

console.log("link selfcheck passed");
