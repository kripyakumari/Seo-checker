import assert from "node:assert/strict";
import { evaluateReadability } from "./checks";
import { extractFromHtml, extractFromText } from "./extract";
import type { ReadabilityDocument } from "./types";

function status(document: ReadabilityDocument, id: string) {
  return evaluateReadability(document).checks.find((item) => item.id === id)?.status;
}

const names = [
  "Minimum text length",
  "Flesch Reading Ease",
  "Grade level (Flesch-Kincaid)",
  "Gunning Fog index",
  "Average sentence length",
  "Long sentences",
  "Very long sentences",
  "Same start",
  "Passive voice",
  "Transition words",
  "Paragraph length",
  "Wall of text",
  "Subheading distribution",
  "Opening paragraph",
  "Complex words",
  "Filler words",
  "Repeated words",
  "Headings",
  "Emphasis",
  "Spelling",
  "Grammar",
  "Language support",
];

const easySentences = [
  "Cats sit in the sun because the day is warm.",
  "Then a small bird hops by, and the cat looks up.",
  "For example, the bird stays on the wall.",
  "However, the cat does not jump yet.",
  "Next the bird flies to a tree.",
  "Finally the cat walks back to the door.",
  "The yard is quiet while the sun stays high.",
  "A child also watches from the step.",
  "The child smiles since the cat is calm.",
  "In fact, both of them like the warm stone.",
  "Meanwhile the bird sings a short song.",
  "Although the song is soft, the cat hears it.",
];
const easy = extractFromText(easySentences.join(" "), "en");
const easyResult = evaluateReadability(easy);
assert.deepEqual(easyResult.checks.map((item) => item.parameter), names);
assert.equal(easyResult.checks.length, 22);
assert.ok((easy.flesch ?? 0) >= 60);
assert.equal(status(easy, "very-long"), "pass");
assert.equal(status(easy, "minimum-length"), "pass");

const hardLine = "Recieve the seperate notes from the office after the team wrote them down in a long line of extra words that keep going past the limit today and still add more plain words so this one sentence stays over thirty five words.";
const hard = extractFromText(`${hardLine} ${hardLine} ${hardLine}`, "en");
assert.equal(status(hard, "very-long"), "error");
assert.equal(status(hard, "spelling"), "warning");
const hardResult = evaluateReadability(hard);
assert.ok((hardResult.score ?? 100) < 100);

const wall = extractFromText(`${"word ".repeat(320)}`, "en");
assert.equal(status(wall, "wall-of-text"), "error");
assert.equal(status(wall, "paragraph-length"), "warning");

const exact150 = extractFromText(`${"word ".repeat(150)}`, "en");
assert.equal(status(exact150, "paragraph-length"), "pass");
assert.equal(status(exact150, "wall-of-text"), "pass");

const short = extractFromText("Cats sit in the warm sun. The bird hops by.", "en");
assert.equal(status(short, "minimum-length"), "info");
assert.equal(status(short, "wall-of-text"), "info");

const hindi = extractFromText("यह एक छोटा लेख है जो पढ़ने के लिए लिखा गया है।", "hi");
const hindiResult = evaluateReadability(hindi);
assert.equal(hindiResult.score, null);
assert.equal(hindiResult.grade, "Not scored");
assert.equal(status(hindi, "flesch"), "info");
assert.equal(status(hindi, "language"), "info");

const html = extractFromHtml("<article><h1>Cats in the sun</h1><p>The cat sits because the day is warm.</p></article>", "en");
assert.ok(html.wordCount > 0);
assert.equal(html.headingCount, 1);

const gradeBase = extractFromText(easySentences.join(" "), "en");
assert.equal(status({ ...gradeBase, gradeLevel: 12 }, "grade-level"), "pass");
assert.equal(status({ ...gradeBase, gradeLevel: 12.1 }, "grade-level"), "warning");
assert.equal(status({ ...gradeBase, flesch: 30 }, "flesch"), "warning");
assert.equal(status({ ...gradeBase, flesch: 29.9 }, "flesch"), "error");
assert.equal(status({ ...gradeBase, fog: 12 }, "gunning-fog"), "warning");

console.log(`readability selfcheck passed ${easyResult.score} ${easyResult.grade}`);
