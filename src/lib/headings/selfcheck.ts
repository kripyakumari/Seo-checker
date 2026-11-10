import assert from "node:assert/strict";
import { evaluateHeadings } from "./checks";
import { extractHeadings } from "./extract";
import type { FoundHeading } from "./types";

function heading(level: number, text: string, extra: Partial<FoundHeading> = {}): FoundHeading {
  return { level, text, empty: text.length === 0, hidden: false, styled: false, ...extra };
}

function run(headings: FoundHeading[], extra: { title?: string; keyword?: string; gaps?: number[]; wordCount?: number } = {}) {
  return evaluateHeadings({
    headings,
    title: extra.title ?? "Plumbing costs for older city homes",
    keyword: extra.keyword ?? "",
    gaps: extra.gaps ?? headings.map(() => 20).concat(20),
    wordCount: extra.wordCount ?? 80,
  });
}

function status(result: ReturnType<typeof run>, id: string) {
  return result.checks.find((item) => item.id === id)?.status;
}

const good = run(
  [
    heading(1, "What older homes pay for plumbing"),
    heading(2, "Pipe repairs"),
    heading(3, "Kitchen lines"),
  ],
  { title: "Plumbing costs for older city homes" },
);
assert.equal(status(good, "h1-present"), "pass");
assert.equal(status(good, "h1-count"), "pass");
assert.equal(status(good, "h1-position"), "pass");
assert.equal(status(good, "heading-order"), "pass");
assert.equal(status(good, "parent-before-child"), "pass");
assert.equal(status(good, "h1-vs-title"), "pass");
assert.equal(good.grade, "Excellent");
assert.equal(good.outline[0]?.text, "What older homes pay for plumbing");
assert.equal(good.outline[0]?.children[0]?.level, 2);

const none = run([]);
assert.equal(status(none, "h1-present"), "error");
assert.equal(status(none, "h1-count"), "pass");
assert.equal(none.checks.find((item) => item.id === "h1-present")?.found, "No headings on this page.");
assert.ok(none.score < 100);

const two = run([heading(1, "Plumbing services"), heading(1, "Emergency plumbing")]);
assert.equal(status(two, "h1-present"), "pass");
assert.equal(status(two, "h1-count"), "error");

const before = run([heading(2, "Services"), heading(1, "Plumbing services")]);
assert.equal(status(before, "h1-position"), "error");

const skip = run([heading(1, "Plumbing services"), heading(2, "Repairs"), heading(4, "Valves")]);
assert.equal(status(skip, "heading-order"), "error");
assert.equal(status(skip, "parent-before-child"), "error");

const earlyChild = run([heading(1, "Plumbing services"), heading(3, "Valves")]);
assert.equal(status(earlyChild, "parent-before-child"), "error");

const empty = run([heading(1, "Plumbing services"), heading(2, "")]);
assert.equal(status(empty, "empty-heading"), "error");

const longText = "a".repeat(71);
const exact = "a".repeat(70);
assert.equal(status(run([heading(1, longText)]), "heading-length"), "warning");
assert.equal(status(run([heading(1, exact)]), "heading-length"), "pass");

assert.equal(status(run([heading(1, "Plumbing services"), heading(2, "More")]), "too-short"), "warning");
assert.equal(status(run([heading(1, "Pricing")]), "too-short"), "pass");

const duplicate = run([heading(1, "Plumbing services"), heading(2, "Plumbing services")]);
assert.equal(status(duplicate, "duplicate-headings"), "warning");

const missingKeyword = run([heading(1, "Roof repairs"), heading(2, "Costs")], { keyword: "plumbing" });
assert.equal(status(missingKeyword, "keyword-h1"), "error");
assert.equal(status(missingKeyword, "keyword-h2"), "warning");

const someH2 = run(
  [heading(1, "Plumbing costs"), heading(2, "Plumbing repairs"), heading(2, "Kitchen lines")],
  { keyword: "plumbing" },
);
assert.equal(status(someH2, "keyword-h1"), "pass");
assert.equal(status(someH2, "keyword-h2"), "pass");
assert.equal(status(someH2, "keyword-stuffing"), "pass");

const stuffed = run(
  [
    heading(1, "Plumbing costs"),
    heading(2, "Plumbing repairs"),
    heading(2, "Plumbing parts"),
    heading(3, "Plumbing tools"),
  ],
  { keyword: "plumbing" },
);
assert.equal(status(stuffed, "keyword-stuffing"), "warning");

const identical = run([heading(1, "Plumbing costs for older city homes")], { title: "Plumbing costs for older city homes" });
assert.equal(status(identical, "h1-vs-title"), "warning");

const unrelated = run([heading(1, "Garden fencing ideas")], { title: "Plumbing costs for older city homes" });
assert.equal(status(unrelated, "h1-vs-title"), "warning");

const gap = run([heading(1, "Plumbing services"), heading(2, "Repairs")], { gaps: [10, 320, 10], wordCount: 340 });
assert.equal(status(gap, "text-between"), "warning");

const longPage = run([heading(1, "Plumbing services")], { wordCount: 500, gaps: [10, 10] });
assert.equal(status(longPage, "heading-count"), "warning");

const hidden = run([heading(1, "Plumbing services"), heading(2, "Hidden repairs", { hidden: true })]);
assert.equal(status(hidden, "hidden-headings"), "warning");

const button = run([heading(1, "Plumbing services"), heading(2, "Book now", { styled: true })]);
assert.equal(status(button, "styling-misuse"), "warning");

const unclear = run([heading(1, "Plumbing services"), heading(2, "Welcome to our website")]);
assert.equal(status(unclear, "too-short"), "pass");

const html = `<!doctype html><html><head><title>Plumbing costs</title></head><body>
<p>${"word ".repeat(12)}</p>
<h1>Plumbing costs for older homes</h1>
<h2>Pipe repairs</h2>
<svg><title>Ignore</title></svg>
<h2 hidden>Secret section</h2>
<button><h3>Book</h3></button>
</body></html>`;
const extracted = extractHeadings(html);
assert.equal(extracted.title, "Plumbing costs");
assert.equal(extracted.headings.length, 4);
assert.equal(extracted.headings[0]?.level, 1);
assert.equal(extracted.headings[2]?.hidden, true);
assert.equal(extracted.headings[3]?.styled, true);
assert.ok(extracted.gaps[0] >= 12);

console.log("heading selfcheck passed");
