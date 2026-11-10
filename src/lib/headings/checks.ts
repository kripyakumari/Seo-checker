import type { FoundHeading, HeadingCheck, HeadingEvaluation, OutlineNode } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;

const GENERIC = new Set([
  "more",
  "info",
  "information",
  "click",
  "here",
  "read",
  "learn",
  "details",
  "section",
  "content",
  "untitled",
  "heading",
  "welcome",
  "hello",
  "overview",
  "miscellaneous",
  "stuff",
  "things",
  "other",
  "link",
  "button",
  "new",
  "update",
  "home",
  "menu",
  "this",
  "that",
]);

const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "by", "at", "from", "our", "your", "you", "about", "page", "website", "site"]);

export function evaluateHeadings(input: {
  headings: FoundHeading[];
  title: string;
  keyword: string;
  gaps: number[];
  wordCount: number;
}): HeadingEvaluation {
  const headings = input.headings;
  const h1 = headings.filter((heading) => heading.level === 1);
  const h2 = headings.filter((heading) => heading.level === 2);
  const checks: HeadingCheck[] = [];

  if (headings.length === 0) {
    checks.push(
      row(
        "h1-present",
        "H1 present",
        "Exactly 1",
        "error",
        "No headings on this page.",
        "Add a real H1 that states what the page is about.",
        ERROR_POINTS,
        "Pages with no headings still get a result. Add one H1, then H2s for the sections.",
      ),
    );
  } else if (h1.length === 0) {
    checks.push(
      row("h1-present", "H1 present", "Exactly 1", "error", "0 H1.", "Add exactly one H1.", ERROR_POINTS, "The page has other headings, but no H1."),
    );
  } else {
    checks.push(
      row(
        "h1-present",
        "H1 present",
        "Exactly 1",
        "pass",
        h1.length === 1 ? "Exactly 1 H1." : "An H1 is present. Extra H1s are counted on the next row.",
        null,
        0,
        h1.map((heading) => heading.text || "(empty heading)").join("\n"),
      ),
    );
  }

  if (h1.length >= 2) {
    checks.push(
      row(
        "h1-count",
        "H1 count",
        "1",
        "error",
        `${h1.length} H1s.`,
        "Keep a single H1 and change the others to H2.",
        ERROR_POINTS,
        h1.map((heading) => heading.text || "(empty heading)").join("\n"),
      ),
    );
  } else {
    checks.push(row("h1-count", "H1 count", "1", "pass", h1.length === 1 ? "1 H1." : "There are not 2 or more H1s.", null, 0, "This row fails only when the page has 2 or more H1s."));
  }

  if (headings.length > 0 && headings[0].level !== 1) {
    checks.push(
      row(
        "h1-position",
        "H1 position",
        "First heading on the page",
        "error",
        `The first heading is an H${headings[0].level}, so another heading comes before the H1.`,
        "Move the H1 above every other heading.",
        ERROR_POINTS,
        `H${headings[0].level}: ${headings[0].text || "(empty heading)"}`,
      ),
    );
  } else {
    checks.push(row("h1-position", "H1 position", "First heading on the page", "pass", headings.length === 0 ? "No heading comes before an H1." : "The H1 is the first heading.", null, 0, ""));
  }

  const skips = skippedLevels(headings);
  if (skips.length > 0) {
    checks.push(
      row(
        "heading-order",
        "Heading order",
        "Each level steps down by 1",
        "error",
        `Skipped level: ${skips[0]}.`,
        "Step down one level at a time, such as H2 then H3, not H2 then H4.",
        ERROR_POINTS,
        skips.join("\n"),
      ),
    );
  } else {
    checks.push(row("heading-order", "Heading order", "Each level steps down by 1", "pass", "No heading level is skipped.", null, 0, ""));
  }

  const orphans = missingParents(headings);
  if (orphans.length > 0) {
    checks.push(
      row(
        "parent-before-child",
        "Parent before child",
        "H2 before any H3, H3 before any H4",
        "error",
        "A heading appears before its parent level.",
        "Place the parent heading first. An H3 needs an H2 above it, and an H4 needs an H3.",
        ERROR_POINTS,
        orphans.join("\n"),
      ),
    );
  } else {
    checks.push(row("parent-before-child", "Parent before child", "H2 before any H3, H3 before any H4", "pass", "Each heading has its parent level above it.", null, 0, ""));
  }

  const empty = headings.filter((heading) => heading.empty);
  if (empty.length > 0) {
    checks.push(
      row(
        "empty-heading",
        "Empty heading",
        "Has text",
        "error",
        `${empty.length} heading ${empty.length === 1 ? "tag has" : "tags have"} no text.`,
        "Add text to the empty heading, or remove the tag.",
        ERROR_POINTS,
        empty.map((heading) => `H${heading.level}: (empty)`).join("\n"),
      ),
    );
  } else {
    checks.push(row("empty-heading", "Empty heading", "Has text", "pass", "Every heading has text.", null, 0, ""));
  }

  const long = headings.filter((heading) => !heading.empty && [...heading.text].length > 70);
  if (long.length > 0) {
    checks.push(
      row(
        "heading-length",
        "Heading length",
        "Under 70 characters",
        "warning",
        `${long.length} heading ${long.length === 1 ? "is" : "are"} over 70 characters.`,
        "Shorten the heading to under 70 characters.",
        WARNING_POINTS,
        long.map((heading) => `H${heading.level} (${[...heading.text].length}): ${heading.text}`).join("\n"),
      ),
    );
  } else {
    checks.push(row("heading-length", "Heading length", "Under 70 characters", "pass", "No heading is over 70 characters.", null, 0, ""));
  }

  const short = headings.filter((heading) => isGenericShort(heading.text));
  if (short.length > 0) {
    checks.push(
      row(
        "too-short",
        "Too short",
        "3+ words",
        "warning",
        `${short.length} heading ${short.length === 1 ? "is" : "are"} 1–2 generic words.`,
        "Replace “More” or “Info” with a heading that says what the section is about.",
        WARNING_POINTS,
        short.map((heading) => `H${heading.level}: ${heading.text}`).join("\n"),
      ),
    );
  } else {
    checks.push(row("too-short", "Too short", "3+ words", "pass", "No heading is only 1–2 generic words.", null, 0, ""));
  }

  const duplicates = duplicateTexts(headings);
  if (duplicates.length > 0) {
    checks.push(
      row(
        "duplicate-headings",
        "Duplicate headings",
        "All unique",
        "warning",
        "The same heading text is used twice.",
        "Give each heading its own text.",
        WARNING_POINTS,
        duplicates.join("\n"),
      ),
    );
  } else {
    checks.push(row("duplicate-headings", "Duplicate headings", "All unique", "pass", "Heading text is not repeated.", null, 0, ""));
  }

  checks.push(keywordInH1(h1, input.keyword));
  checks.push(keywordInH2(h2, input.keyword));
  checks.push(keywordStuffing(headings, input.keyword));
  checks.push(h1VersusTitle(h1[0]?.text ?? "", input.title, h1.length));
  checks.push(textBetween(input.gaps, headings));
  checks.push(headingCount(input.wordCount, h2.length));

  const hidden = headings.filter((heading) => heading.hidden);
  if (hidden.length > 0) {
    checks.push(
      row(
        "hidden-headings",
        "Hidden headings",
        "Visible on page",
        "warning",
        `${hidden.length} heading ${hidden.length === 1 ? "is" : "are"} hidden in the HTML.`,
        "Remove headings that are hidden with CSS, or make them visible. Hidden text should not carry the outline.",
        WARNING_POINTS,
        hidden.map((heading) => `H${heading.level}: ${heading.text || "(empty heading)"}`).join("\n"),
      ),
    );
  } else {
    checks.push(row("hidden-headings", "Hidden headings", "Visible on page", "pass", "No heading is hidden in the HTML.", null, 0, ""));
  }

  const styled = headings.filter((heading) => heading.styled);
  if (styled.length > 0) {
    checks.push(
      row(
        "styling-misuse",
        "Styling misuse",
        "Headings mark sections",
        "warning",
        `${styled.length} heading ${styled.length === 1 ? "looks" : "look"} like big text rather than a section.`,
        "Use a heading only to start a section. Use CSS for a button label or a paragraph.",
        WARNING_POINTS,
        styled.map((heading) => `H${heading.level}: ${heading.text || "(empty heading)"}`).join("\n"),
      ),
    );
  } else {
    checks.push(row("styling-misuse", "Styling misuse", "Headings mark sections", "pass", "Headings are marking sections.", null, 0, ""));
  }

  const score = clamp(100 + checks.reduce((sum, item) => sum + item.points, 0));
  return {
    score,
    grade: gradeFor(score),
    headingCount: headings.length,
    h1Count: h1.length,
    wordCount: input.wordCount,
    checks,
    outline: buildOutline(headings),
    headings,
  };
}

export function buildOutline(headings: FoundHeading[]): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: { level: number; node: OutlineNode }[] = [];
  for (const heading of headings) {
    const node: OutlineNode = { level: heading.level, text: heading.text || "(empty heading)", children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ level: heading.level, node });
  }
  return root;
}

export function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function keywordInH1(h1: FoundHeading[], keyword: string): HeadingCheck {
  if (!keyword) {
    return row("keyword-h1", "Keyword in H1", "Present", "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  if (h1.length === 0) {
    return row("keyword-h1", "Keyword in H1", "Present", "info", "No H1 to search. Add an H1 first.", null, 0, "");
  }
  const hit = h1.some((heading) => countPhrase(heading.text, keyword) > 0);
  if (hit) return row("keyword-h1", "Keyword in H1", "Present", "pass", `The H1 includes “${keyword}”.`, null, 0, "");
  return row("keyword-h1", "Keyword in H1", "Present", "error", `“${keyword}” was not found in the H1.`, "Use the focus keyword in the H1 where it fits naturally.", ERROR_POINTS, h1.map((heading) => heading.text).join("\n"));
}

function keywordInH2(h2: FoundHeading[], keyword: string): HeadingCheck {
  if (!keyword) {
    return row("keyword-h2", "Keyword in H2s", "In some H2s", "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  const hits = h2.filter((heading) => countPhrase(heading.text, keyword) > 0);
  if (hits.length > 0) {
    return row("keyword-h2", "Keyword in H2s", "In some H2s", "pass", `The focus keyword is in ${hits.length} H2${hits.length === 1 ? "" : "s"}.`, null, 0, hits.map((heading) => heading.text).join("\n"));
  }
  return row("keyword-h2", "Keyword in H2s", "In some H2s", "warning", "The focus keyword is in no H2.", "Use the keyword in the H2s that are actually about that topic.", WARNING_POINTS, "");
}

function keywordStuffing(headings: FoundHeading[], keyword: string): HeadingCheck {
  if (!keyword) {
    return row("keyword-stuffing", "Keyword stuffing", "Natural use", "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  if (headings.length === 0) {
    return row("keyword-stuffing", "Keyword stuffing", "Natural use", "pass", "There are no headings to stuff.", null, 0, "");
  }
  const hits = headings.filter((heading) => countPhrase(heading.text, keyword) > 0);
  if (headings.length >= 3 && hits.length / headings.length >= 0.8) {
    return row(
      "keyword-stuffing",
      "Keyword stuffing",
      "Natural use",
      "warning",
      `The focus keyword is in ${hits.length} of ${headings.length} headings.`,
      "Keep the keyword in the H1 and the H2s that match it. Do not put it in almost every heading.",
      WARNING_POINTS,
      hits.map((heading) => `H${heading.level}: ${heading.text}`).join("\n"),
    );
  }
  return row("keyword-stuffing", "Keyword stuffing", "Natural use", "pass", "The focus keyword is not in almost every heading.", null, 0, "");
}

function h1VersusTitle(h1: string, title: string, h1Count: number): HeadingCheck {
  if (!h1) {
    return row("h1-vs-title", "H1 vs title", "Same topic, different words", "info", "No H1 to compare with the title.", null, 0, "");
  }
  if (!title) {
    return row("h1-vs-title", "H1 vs title", "Same topic, different words", "info", "No title tag to compare with the H1.", null, 0, "");
  }
  if (normalize(h1) === normalize(title)) {
    return row(
      "h1-vs-title",
      "H1 vs title",
      "Same topic, different words",
      "warning",
      h1Count > 1 ? "The title copies the first of the H1s word for word." : "The H1 and the title are identical.",
      "Keep the same topic, and use different words in the H1.",
      WARNING_POINTS,
      `Title: ${title}\nH1: ${h1}`,
    );
  }
  if (overlap(title, h1) > 0) {
    return row("h1-vs-title", "H1 vs title", "Same topic, different words", "pass", "The H1 covers the same topic as the title, with different words.", null, 0, `Title: ${title}\nH1: ${h1}`);
  }
  return row(
    "h1-vs-title",
    "H1 vs title",
    "Same topic, different words",
    "warning",
    "The H1 and the title do not share a topic word.",
    "Align the H1 with the title’s topic, and keep the wording different.",
    WARNING_POINTS,
    `Title: ${title}\nH1: ${h1}`,
  );
}

function textBetween(gaps: number[], headings: FoundHeading[]): HeadingCheck {
  const long = gaps
    .map((words, index) => ({ words, index }))
    .filter((gap) => gap.words >= 300);
  if (long.length === 0) {
    return row("text-between", "Text between headings", "Under 300 words per section", "pass", "No section runs 300 words without a heading.", null, 0, "");
  }
  return row(
    "text-between",
    "Text between headings",
    "Under 300 words per section",
    "warning",
    `${long.length} section ${long.length === 1 ? "has" : "have"} 300 or more words with no subheading.`,
    "Add a subheading before a section reaches 300 words.",
    WARNING_POINTS,
    long
      .map((gap) => {
        const before = gap.index === 0 ? "Before the first heading" : `After H${headings[gap.index - 1]?.level ?? "?"}: ${headings[gap.index - 1]?.text || "(empty heading)"}`;
        return `${before} — ${gap.words} words`;
      })
      .join("\n"),
  );
}

function headingCount(wordCount: number, h2Count: number): HeadingCheck {
  if (wordCount >= 500 && h2Count === 0) {
    return row(
      "heading-count",
      "Heading count",
      "At least 1 H2 for long pages",
      "warning",
      `This page has about ${wordCount} words and no H2.`,
      "Add at least one H2 on a page of 500 words or more.",
      WARNING_POINTS,
      "",
    );
  }
  return row(
    "heading-count",
    "Heading count",
    "At least 1 H2 for long pages",
    "pass",
    wordCount >= 500 ? `${h2Count} H2s on a long page.` : "This page is under 500 words, so an H2 is not required by this row.",
    null,
    0,
    "",
  );
}

function skippedLevels(headings: FoundHeading[]) {
  const skips: string[] = [];
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.level > previous.level + 1) skips.push(`H${previous.level} → H${current.level}`);
  }
  return skips;
}

function missingParents(headings: FoundHeading[]) {
  const issues: string[] = [];
  const stack: number[] = [];
  for (const heading of headings) {
    while (stack.length > 0 && stack[stack.length - 1] >= heading.level) stack.pop();
    if (heading.level > 1 && (stack.length === 0 || stack[stack.length - 1] !== heading.level - 1)) {
      issues.push(`H${heading.level} before an H${heading.level - 1}: ${heading.text || "(empty heading)"}`);
    }
    stack.push(heading.level);
  }
  return issues;
}

function duplicateTexts(headings: FoundHeading[]) {
  const seen = new Map<string, number>();
  for (const heading of headings) {
    const key = normalize(heading.text);
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count >= 2).map(([text, count]) => `${text} (${count})`);
}

function isGenericShort(text: string) {
  const words = wordsOf(text);
  return words.length >= 1 && words.length <= 2 && words.every((word) => GENERIC.has(word));
}

function wordsOf(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

function countPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  return [...text.matchAll(pattern)].length;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length >= 2 && !STOP.has(word));
}

function overlap(a: string, b: string) {
  const right = new Set(tokens(b));
  return tokens(a).filter((word) => right.has(word)).length;
}

function row(
  id: string,
  parameter: string,
  ideal: string,
  status: HeadingCheck["status"],
  found: string,
  fix: string | null,
  points: number,
  details: string,
): HeadingCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}

function clamp(score: number) {
  return Math.min(100, Math.max(0, score));
}
