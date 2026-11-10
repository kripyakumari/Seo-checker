import { DESKTOP_LIMIT, MOBILE_LIMIT, measureDescriptionPixels } from "./pixels";
import type { DescriptionCheck, DescriptionEvaluation } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;
const MOBILE_KEYWORD_CHARS = 110;

const CTA = ["shop", "learn", "compare", "get"];

const STOP = new Set(["a", "an", "and", "are", "at", "by", "for", "from", "in", "is", "of", "on", "or", "our", "the", "to", "with", "your"]);

export function evaluateDescription(input: {
  description: string;
  descriptionCount: number;
  title: string;
  ogDescription: string | null;
  keyword: string;
  firstParagraph: string;
}): DescriptionEvaluation {
  const description = input.description;
  const pixels = measureDescriptionPixels(description);
  const characters = [...description].length;
  const words = description ? description.split(/\s+/).filter(Boolean).length : 0;
  const keyword = input.keyword.replace(/\s+/g, " ").trim();

  const checks: DescriptionCheck[] = [
    descriptionPresent(description, input.firstParagraph),
    characterLength(characters, description),
    desktopWidth(pixels.width),
    mobileWidth(pixels.width),
    keywordPresent(description, keyword),
    keywordVisible(description, keyword),
    keywordRepeats(description, keyword),
    callToAction(description),
    differentFromTitle(description, input.title),
    doubleQuotes(description),
    allCaps(description),
    emojiAndSymbols(description),
    endsCleanly(description, pixels.desktopCut),
    descriptionTagCount(input.descriptionCount),
    summaryVsOg(description, input.ogDescription),
  ];

  let score = 100;
  for (const check of checks) score += check.points;
  score = Math.max(0, Math.min(100, score));
  const topIssues = checks
    .filter((check) => check.points < 0)
    .sort((a, b) => a.points - b.points || (a.status === "error" ? -1 : 1))
    .slice(0, 3);

  return {
    score,
    grade: gradeFor(score),
    description,
    measurements: {
      characters,
      words,
      desktopPx: pixels.width,
      mobilePx: pixels.width,
      desktopCut: pixels.desktopCut,
      mobileCut: pixels.mobileCut,
    },
    checks,
    topIssues,
  };
}

function descriptionPresent(description: string, firstParagraph: string): DescriptionCheck {
  if (description) {
    return row("description-present", "Description present", "1 non-empty description", "pass", "A meta description is present.", null, 0, "");
  }
  return row(
    "description-present",
    "Description present",
    "1 non-empty description",
    "error",
    "The meta description is missing or empty.",
    firstParagraph
      ? `Add a meta description. Google may show this opening instead: “${clip(firstParagraph, 160)}”`
      : "Add one clear meta description that summarises this page.",
    ERROR_POINTS,
    firstParagraph ? `First paragraph hint: ${firstParagraph}` : "",
  );
}

function characterLength(characters: number, description: string): DescriptionCheck {
  if (!description) {
    return row("character-length", "Character length", "120–160", "error", "0 characters.", "Write 120–160 characters.", ERROR_POINTS, "");
  }
  if (characters < 70) {
    return row("character-length", "Character length", "120–160", "error", `${characters} characters (under 70).`, "Expand the description to at least 120 characters.", ERROR_POINTS, "");
  }
  if (characters < 120) {
    return row("character-length", "Character length", "120–160", "warning", `${characters} characters (70–119).`, "Aim for 120–160 characters so the snippet has room.", WARNING_POINTS, "");
  }
  if (characters > 160) {
    return row("character-length", "Character length", "120–160", "warning", `${characters} characters (over 160).`, "Shorten the description to about 120–160 characters.", WARNING_POINTS, "");
  }
  return row("character-length", "Character length", "120–160", "pass", `${characters} characters.`, null, 0, "");
}

function desktopWidth(width: number): DescriptionCheck {
  if (width > DESKTOP_LIMIT) {
    return row(
      "desktop-width",
      "Desktop pixel width",
      `≤ ${DESKTOP_LIMIT}px`,
      "error",
      `${width}px is over ${DESKTOP_LIMIT}px.`,
      "Shorten the description so it fits the desktop snippet cut.",
      ERROR_POINTS,
      "",
    );
  }
  return row("desktop-width", "Desktop pixel width", `≤ ${DESKTOP_LIMIT}px`, "pass", `${width}px.`, null, 0, "");
}

function mobileWidth(width: number): DescriptionCheck {
  if (width > MOBILE_LIMIT) {
    return row(
      "mobile-width",
      "Mobile pixel width",
      `≤ ${MOBILE_LIMIT}px`,
      "warning",
      `${width}px is over ${MOBILE_LIMIT}px.`,
      "Shorten the start of the description so the mobile snippet keeps the main point.",
      WARNING_POINTS,
      "",
    );
  }
  return row("mobile-width", "Mobile pixel width", `≤ ${MOBILE_LIMIT}px`, "pass", `${width}px.`, null, 0, "");
}

function keywordPresent(description: string, keyword: string): DescriptionCheck {
  if (!keyword) {
    return row("keyword-present", "Keyword present", "In description", "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  if (!description) {
    return row("keyword-present", "Keyword present", "In description", "warning", `“${keyword}” cannot be checked without a description.`, "Add a description that includes the focus keyword.", WARNING_POINTS, "");
  }
  if (countPhrase(description, keyword) === 0) {
    return row("keyword-present", "Keyword present", "In description", "warning", `“${keyword}” was not found in the description.`, "Include the focus keyword once in the meta description.", WARNING_POINTS, "");
  }
  return row("keyword-present", "Keyword present", "In description", "pass", `The description includes “${keyword}”.`, null, 0, "");
}

function keywordVisible(description: string, keyword: string): DescriptionCheck {
  if (!keyword) {
    return row("keyword-visible", "Keyword visible on mobile", `In first ~${MOBILE_KEYWORD_CHARS} characters`, "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  if (!description || countPhrase(description, keyword) === 0) {
    return row(
      "keyword-visible",
      "Keyword visible on mobile",
      `In first ~${MOBILE_KEYWORD_CHARS} characters`,
      "info",
      "Not checked because the keyword is not in the description.",
      null,
      0,
      "",
    );
  }
  const head = [...description].slice(0, MOBILE_KEYWORD_CHARS).join("");
  if (countPhrase(head, keyword) > 0) {
    return row(
      "keyword-visible",
      "Keyword visible on mobile",
      `In first ~${MOBILE_KEYWORD_CHARS} characters`,
      "pass",
      `“${keyword}” appears in the first ${MOBILE_KEYWORD_CHARS} characters.`,
      null,
      0,
      "",
    );
  }
  return row(
    "keyword-visible",
    "Keyword visible on mobile",
    `In first ~${MOBILE_KEYWORD_CHARS} characters`,
    "warning",
    `“${keyword}” appears after the first ${MOBILE_KEYWORD_CHARS} characters.`,
    "Move the focus keyword closer to the start of the description.",
    WARNING_POINTS,
    "",
  );
}

function keywordRepeats(description: string, keyword: string): DescriptionCheck {
  if (!keyword) {
    return row("keyword-repeats", "Keyword repeats", "1–2 times", "info", "No focus keyword was entered, so this was not scored.", null, 0, "");
  }
  if (!description) {
    return row("keyword-repeats", "Keyword repeats", "1–2 times", "pass", "No description to repeat the keyword in.", null, 0, "");
  }
  const count = countPhrase(description, keyword);
  if (count >= 3) {
    return row(
      "keyword-repeats",
      "Keyword repeats",
      "1–2 times",
      "warning",
      `“${keyword}” appears ${count} times.`,
      "Keep the focus keyword to one or two natural uses.",
      WARNING_POINTS,
      "",
    );
  }
  return row(
    "keyword-repeats",
    "Keyword repeats",
    "1–2 times",
    "pass",
    count === 0 ? "The keyword is not repeated in the description." : `“${keyword}” appears ${count} time${count === 1 ? "" : "s"}.`,
    null,
    0,
    "",
  );
}

function callToAction(description: string): DescriptionCheck {
  if (!description) {
    return row("call-to-action", "Call to action", "Present (Shop, Learn, Compare, Get)", "warning", "No description to hold a call to action.", "Add a short CTA such as Learn, Shop, Compare, or Get.", WARNING_POINTS, "");
  }
  const found = CTA.filter((word) => countPhrase(description, word) > 0);
  if (found.length === 0) {
    return row(
      "call-to-action",
      "Call to action",
      "Present (Shop, Learn, Compare, Get)",
      "warning",
      "No Shop, Learn, Compare, or Get wording.",
      "Add a clear call to action such as Learn more, Shop now, Compare options, or Get started.",
      WARNING_POINTS,
      "",
    );
  }
  return row("call-to-action", "Call to action", "Present (Shop, Learn, Compare, Get)", "pass", `CTA wording found: ${found.join(", ")}.`, null, 0, "");
}

function differentFromTitle(description: string, title: string): DescriptionCheck {
  if (!description) {
    return row("different-from-title", "Different from title", "Adds new information", "pass", "No description to compare with the title.", null, 0, "");
  }
  if (!title) {
    return row("different-from-title", "Different from title", "Adds new information", "pass", "No title to compare.", null, 0, "");
  }
  if (repeatsTitle(description, title)) {
    return row(
      "different-from-title",
      "Different from title",
      "Adds new information",
      "warning",
      "The description is the same as or repeats the title.",
      "Rewrite the description so it adds detail the title does not already say.",
      WARNING_POINTS,
      `Title: ${title}`,
    );
  }
  return row("different-from-title", "Different from title", "Adds new information", "pass", "The description adds information beyond the title.", null, 0, "");
}

function doubleQuotes(description: string): DescriptionCheck {
  if (!description) {
    return row("double-quotes", "Double quotes", "None", "pass", "No description to check for quotes.", null, 0, "");
  }
  if (description.includes('"') || description.includes("\u201c") || description.includes("\u201d")) {
    return row(
      "double-quotes",
      "Double quotes",
      "None",
      "warning",
      "The description contains double quotes.",
      "Remove \" characters so they cannot break the meta tag.",
      WARNING_POINTS,
      "",
    );
  }
  return row("double-quotes", "Double quotes", "None", "pass", "No double quotes.", null, 0, "");
}

function allCaps(description: string): DescriptionCheck {
  if (!description) {
    return row("all-caps", "ALL CAPS", "None", "pass", "No description to check for caps.", null, 0, "");
  }
  const shouted = description
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((word) => word.length >= 4 && /^\p{Lu}+$/u.test(word));
  if (shouted.length === 0) {
    return row("all-caps", "ALL CAPS", "None", "pass", "No full-caps word of 4 or more letters.", null, 0, "");
  }
  const list = [...new Set(shouted)].slice(0, 4).join(", ");
  return row("all-caps", "ALL CAPS", "None", "warning", `Full-caps ${shouted.length === 1 ? "word" : "words"}: ${list}.`, `Rewrite ${list} in normal case.`, WARNING_POINTS, "");
}

function emojiAndSymbols(description: string): DescriptionCheck {
  if (!description) {
    return row("emoji-symbols", "Emoji / symbols", "None or one", "pass", "No description to check.", null, 0, "");
  }
  const emojis = description.match(/\p{Extended_Pictographic}/gu) ?? [];
  const problems: string[] = [];
  if (emojis.length > 1) problems.push(`${emojis.length} emojis`);
  if (/!{2,}|\?{2,}/.test(description)) problems.push("repeated punctuation");
  if (/\${2,}/.test(description)) problems.push("$$$");
  if (/[★☆✓✔✕✖✪✩♥►▶●]/.test(description)) problems.push("a decorative symbol");
  if (problems.length === 0) {
    return row(
      "emoji-symbols",
      "Emoji / symbols",
      "None or one",
      "pass",
      emojis.length === 1 ? "One emoji, no spam symbols." : "No emoji spam, !!!, or $$$.",
      null,
      0,
      "",
    );
  }
  return row(
    "emoji-symbols",
    "Emoji / symbols",
    "None or one",
    "warning",
    `Contains ${problems.join(" and ")}.`,
    "Keep at most one emoji and remove !!! or $$$.",
    WARNING_POINTS,
    "",
  );
}

function endsCleanly(description: string, desktopCut: number): DescriptionCheck {
  if (!description) {
    return row("ends-cleanly", "Ends cleanly", "Full sentence before cut-off", "pass", "No description to cut.", null, 0, "");
  }
  if (desktopCut >= description.length) {
    return row("ends-cleanly", "Ends cleanly", "Full sentence before cut-off", "pass", "The full description fits before the desktop cut-off.", null, 0, "");
  }
  const visible = description.slice(0, desktopCut);
  const next = description[desktopCut] ?? "";
  const prev = description[desktopCut - 1] ?? "";
  const midWord = /[\p{L}\p{N}]/u.test(prev) && /[\p{L}\p{N}]/u.test(next);
  const endsSentence = /[.!?]["')\]]*$/.test(visible.trim());
  if (midWord || !endsSentence) {
    return row(
      "ends-cleanly",
      "Ends cleanly",
      "Full sentence before cut-off",
      "warning",
      midWord ? "The desktop cut lands mid-word." : "The desktop cut lands mid-sentence.",
      "Rewrite so a full sentence finishes before the snippet cut-off.",
      WARNING_POINTS,
      `Cut after: “${clip(visible, 80)}”`,
    );
  }
  return row("ends-cleanly", "Ends cleanly", "Full sentence before cut-off", "pass", "A full sentence finishes before the desktop cut-off.", null, 0, "");
}

function descriptionTagCount(count: number): DescriptionCheck {
  if (count === 1) {
    return row("description-tag-count", "Description tag count", "Exactly 1", "pass", "Exactly 1 meta description tag.", null, 0, "");
  }
  return row(
    "description-tag-count",
    "Description tag count",
    "Exactly 1",
    "error",
    count === 0 ? "0 meta description tags." : `${count} meta description tags.`,
    count === 0 ? "Add exactly one meta name=\"description\" tag in the head." : "Keep a single meta description tag and remove the extras.",
    ERROR_POINTS,
    "",
  );
}

function summaryVsOg(description: string, ogDescription: string | null): DescriptionCheck {
  if (!description) {
    return row(
      "summary-vs-og",
      "Summary vs og:description",
      "Roughly match",
      "warning",
      "No meta description to compare with og:description.",
      "Add a meta description, then keep og:description close to it.",
      WARNING_POINTS,
      "",
    );
  }
  if (!ogDescription) {
    return row(
      "summary-vs-og",
      "Summary vs og:description",
      "Roughly match",
      "warning",
      "No og:description was found.",
      "Add an og:description that roughly matches the meta description.",
      WARNING_POINTS,
      "",
    );
  }
  if (roughlyMatches(description, ogDescription)) {
    return row("summary-vs-og", "Summary vs og:description", "Roughly match", "pass", "The og:description roughly matches the meta description.", null, 0, "");
  }
  return row(
    "summary-vs-og",
    "Summary vs og:description",
    "Roughly match",
    "warning",
    "The og:description is very different from the meta description.",
    "Rewrite og:description so it stays close to the meta description.",
    WARNING_POINTS,
    ogDescription,
  );
}

function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function countPhrase(text: string, phrase: string) {
  const needle = normalize(phrase);
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  return [...normalize(text).matchAll(pattern)].length;
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

function roughlyMatches(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  return jaccard(a, b) >= 0.45;
}

function repeatsTitle(description: string, title: string) {
  const a = normalize(description);
  const b = normalize(title);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) && a.length <= b.length + 24) return true;
  if (b.startsWith(a) && b.length <= a.length + 24) return true;
  return jaccard(description, title) >= 0.75;
}

function jaccard(a: string, b: string) {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  const union = setA.size + setB.size - shared;
  return union > 0 ? shared / union : 0;
}

function clip(value: string, max: number) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function row(
  id: string,
  parameter: string,
  ideal: string,
  status: DescriptionCheck["status"],
  found: string,
  fix: string | null,
  points: number,
  details: string,
): DescriptionCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}
