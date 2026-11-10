import assert from "node:assert/strict";
import { evaluateDescription } from "./checks";

const names = [
  "Description present",
  "Character length",
  "Desktop pixel width",
  "Mobile pixel width",
  "Keyword present",
  "Keyword visible on mobile",
  "Keyword repeats",
  "Call to action",
  "Different from title",
  "Double quotes",
  "ALL CAPS",
  "Emoji / symbols",
  "Ends cleanly",
  "Description tag count",
  "Summary vs og:description",
];

const goodText =
  "Learn how running shoes support beginners on longer outdoor miles. Compare cushion options and get a fit that lasts through weekly training.";

function status(
  id: string,
  description = goodText,
  extra: Partial<Parameters<typeof evaluateDescription>[0]> = {},
) {
  return evaluateDescription({
    description,
    descriptionCount: 1,
    title: "Running shoes guide for beginners",
    ogDescription: goodText,
    keyword: "running shoes",
    firstParagraph: "Running shoes help beginners stay comfortable.",
    ...extra,
    description: extra.description ?? description,
  }).checks.find((item) => item.id === id)?.status;
}

const good = evaluateDescription({
  description: goodText,
  descriptionCount: 1,
  title: "Running shoes guide for beginners",
  ogDescription: goodText,
  keyword: "running shoes",
  firstParagraph: "Running shoes help beginners stay comfortable.",
});
assert.deepEqual(good.checks.map((item) => item.parameter), names);
assert.equal(good.checks.length, 15);
assert.equal(status("description-present"), "pass");
assert.equal(status("character-length"), "pass");
assert.equal(status("keyword-present"), "pass");
assert.equal(status("call-to-action"), "pass");
assert.equal(status("description-tag-count"), "pass");
assert.equal(status("summary-vs-og"), "pass");

assert.equal(status("description-present", "", { description: "", descriptionCount: 0 }), "error");
assert.equal(status("character-length", "Too short."), "error");
assert.equal(status("character-length", "x".repeat(90)), "warning");
assert.equal(status("character-length", `${goodText} ${"extra words ".repeat(20)}`), "warning");
assert.equal(status("keyword-present", goodText, { keyword: "missing phrase" }), "warning");
assert.equal(status("keyword-present", goodText, { keyword: "" }), "info");
assert.equal(status("keyword-repeats", "running shoes running shoes running shoes and more text here to pad length for the meta description checker self test case."), "warning");
assert.equal(status("call-to-action", "A long enough meta description without any of the listed action words for shoppers or readers on this page today."), "warning");
assert.equal(status("double-quotes", 'Learn more about "running shoes" and how beginners can compare fit on longer outdoor training miles this season.'), "warning");
assert.equal(status("all-caps", "Learn how RUNNING shoes support beginners on longer outdoor miles with clear COMPARE tips for weekly training."), "warning");
assert.equal(status("emoji-symbols", "Learn how running shoes support beginners!!! Compare cushion options and get a fit that lasts through weekly training."), "warning");
assert.equal(status("description-tag-count", goodText, { descriptionCount: 0 }), "error");
assert.equal(status("description-tag-count", goodText, { descriptionCount: 2 }), "error");
assert.equal(status("summary-vs-og", goodText, { ogDescription: null }), "warning");
assert.equal(status("summary-vs-og", goodText, { ogDescription: "Completely unrelated product brochure about garden furniture sales." }), "warning");
assert.equal(status("different-from-title", "Running shoes guide for beginners", { title: "Running shoes guide for beginners" }), "warning");

console.log(`meta description selfcheck passed ${good.score} ${good.grade}`);
