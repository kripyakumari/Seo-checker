import assert from "node:assert/strict";
import { evaluateKeyword } from "./checks";
import type { KeywordPage } from "./types";

const names = [
  "In title",
  "In H1",
  "In first paragraph",
  "In H2s",
  "In meta description",
  "Keyword stuffing",
  "Clustered use",
  "Stuffed headings",
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

function status(id: string, subject = page(), keyword = "running shoes") {
  return evaluateKeyword(subject, keyword).checks.find((item) => item.id === id)?.status;
}

const good = evaluateKeyword(page(), "running shoes");
assert.deepEqual(good.checks.map((item) => item.parameter), names);
assert.equal(good.checks.length, 8);
assert.equal(status("in-title"), "pass");
assert.equal(status("in-h1"), "pass");
assert.equal(status("in-first-paragraph"), "pass");
assert.equal(status("in-h2s"), "pass");
assert.equal(status("in-meta"), "pass");
assert.equal(status("keyword-stuffing"), "pass");

assert.equal(status("in-title", page({ title: "A guide for beginners" })), "error");
assert.equal(status("in-title", page({ title: "A complete beginner guide to running shoes" })), "pass");
assert.equal(status("in-title", page({ title: "Running shoes: a beginner guide" })), "pass");
assert.equal(status("in-title", page({ title: "Graphic Design Agency in Chichester | Biztalbox" }), "Creative Graphic Design Company In Chichester"), "pass");
assert.equal(status("in-title", page({ title: "Biztalbox homepage" }), "Creative Graphic Design Company In Chichester"), "error");
assert.equal(status("in-h1", page({ h1: ["Beginner guide"] })), "error");
assert.equal(status("in-h2s", page({ h2: ["Fit tips", "Care tips"] })), "warning");
assert.equal(status("in-meta", page({ metaDescription: "A short product page summary." })), "warning");

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

const headings = page({
  headings: ["Running shoes one", "Running shoes two", "Running shoes three", "Running shoes four"],
  h1: ["Running shoes one"],
  h2: ["Running shoes two", "Running shoes three"],
});
assert.equal(status("stuffed-headings", headings), "warning");

console.log(`keyword selfcheck passed ${good.score} ${good.grade}`);
