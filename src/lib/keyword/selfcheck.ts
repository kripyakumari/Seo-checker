import assert from "node:assert/strict";
import { evaluateKeyword } from "./checks";
import type { KeywordPage } from "./types";

const names = [
  "Search intent",
  "Better keyword",
  "In title",
  "In H1",
  "In first paragraph",
  "In H2s",
  "In meta description",
  "In URL slug",
  "In image alt",
  "Keyword stuffing",
  "Density",
  "Clustered use",
  "Distribution",
  "Stuffed headings",
  "Synonyms and variants",
  "Word forms",
  "Secondary keywords",
  "Related terms",
  "Long-tail phrases",
  "Questions",
  "Usage vs top 10",
  "Intent match",
  "Cannibalization",
];

function page(partial: Partial<KeywordPage> = {}): KeywordPage {
  const body =
    partial.bodyText ??
    [
      "Running shoes help beginners stay comfortable on the first outdoor miles.",
      "A good pair supports the foot, manages impact, and lasts through weekly training sessions without unnecessary bulk.",
      "Look for cushion that matches your stride, and try shoes on late in the day when feet are a little larger.",
      "Replace worn outsoles before long races so your next run still feels stable on mixed terrain.",
      "How to pick running shoes depends on fit, cushion, and how often you train each week across easy and harder days.",
      "Road surfaces, trail grip, and sock choice also change how a beginner shoe feels after the first few outings.",
      "Keep a short log of distance, soreness, and weather so you can tell when the foam has gone flat.",
      "A simple rotation with a lighter second pair can extend the life of your main training shoe through the season.",
    ].join(" ");
  return {
    title: "Running shoes guide for beginners",
    h1: ["Running shoes for beginners"],
    h2: ["How to pick running shoes", "Fit and cushion"],
    headings: ["Running shoes for beginners", "How to pick running shoes", "Fit and cushion"],
    metaDescription: "A simple guide to choosing running shoes that fit and feel good.",
    slug: "running-shoes-guide",
    alts: ["Pair of running shoes on a track"],
    paragraphs: body.split(/(?<=\.)\s+/),
    bodyText: body,
    wordCount: body.split(/\s+/).filter(Boolean).length,
    ...partial,
  };
}

function status(id: string, subject = page(), keyword = "running shoes", secondary: string[] = []) {
  return evaluateKeyword(subject, keyword, secondary).checks.find((item) => item.id === id)?.status;
}

const good = evaluateKeyword(page(), "running shoes", ["cushion"]);
assert.deepEqual(good.checks.map((item) => item.parameter), names);
assert.equal(good.checks.length, 23);
assert.equal(status("search-intent"), "info");
assert.equal(status("better-keyword"), "info");
assert.equal(status("density"), "info");
assert.equal(status("word-forms"), "info");
assert.equal(status("related-terms"), "info");
assert.equal(status("long-tail"), "info");
assert.equal(status("questions"), "info");
assert.equal(status("usage-vs-top10"), "info");
assert.equal(status("intent-match"), "info");
assert.equal(status("cannibalization"), "info");
assert.equal(status("in-title"), "pass");
assert.equal(status("in-h1"), "pass");
assert.equal(status("in-first-paragraph"), "pass");
assert.equal(status("in-h2s"), "pass");
assert.equal(status("in-meta"), "pass");
assert.equal(status("in-slug"), "pass");
assert.equal(status("in-alt"), "pass");
assert.equal(status("keyword-stuffing"), "pass");

assert.equal(status("in-title", page({ title: "A guide for beginners" })), "error");
assert.equal(status("in-title", page({ title: "A complete beginner guide to running shoes" })), "pass");
assert.equal(status("in-title", page({ title: "Running shoes: a beginner guide" })), "pass");
assert.equal(status("in-h1", page({ h1: ["Beginner guide"] })), "error");
assert.equal(status("in-h2s", page({ h2: ["Fit tips", "Care tips"] })), "warning");
assert.equal(status("in-meta", page({ metaDescription: "A short product page summary." })), "warning");
assert.equal(status("in-slug", page({ slug: "beginner-guide" })), "info");
assert.equal(status("in-alt", page({ alts: ["Track photo"] })), "info");
assert.equal(status("distribution", page({ bodyText: "Running shoes start this page. " + "cushion ".repeat(80), wordCount: 90 })), "info");

const stuffedBody = Array.from({ length: 8 }, () => "Buy running shoes today.").join(" ") + " Extra filler words for length here and there across this short page.";
assert.equal(
  status(
    "keyword-stuffing",
    page({
      bodyText: stuffedBody,
      paragraphs: stuffedBody.split(/(?<=\.)\s+/),
      wordCount: stuffedBody.split(/\s+/).filter(Boolean).length,
    }),
  ),
  "error",
);

const clustered = page({
  paragraphs: ["Running shoes, running shoes, and more running shoes in one block.", "Later text about fit."],
  bodyText: "Running shoes, running shoes, and more running shoes in one block. Later text about fit.",
  wordCount: 16,
});
assert.equal(status("clustered-use", clustered), "warning");

assert.equal(status("secondary-keywords", page(), "running shoes", []), "info");
assert.equal(status("secondary-keywords", page(), "running shoes", ["missing phrase"]), "warning");
assert.equal(status("secondary-keywords", page(), "running shoes", ["cushion"]), "pass");

const headings = page({
  headings: ["Running shoes one", "Running shoes two", "Running shoes three", "Running shoes four"],
  h1: ["Running shoes one"],
  h2: ["Running shoes two", "Running shoes three"],
});
assert.equal(status("stuffed-headings", headings), "warning");

console.log(`keyword selfcheck passed ${good.score} ${good.grade}`);
