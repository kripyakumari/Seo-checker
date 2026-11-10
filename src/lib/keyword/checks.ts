import { countExact, normalize, wordsOf } from "./extract";
import type { KeywordCheck, KeywordEvaluation, KeywordPage } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;

export function evaluateKeyword(page: KeywordPage, keyword: string): KeywordEvaluation {
  const key = keyword.replace(/\s+/g, " ").trim();
  const forms = wordForms(key);
  const bodyExact = countExact(page.bodyText, key);
  const variantCount = countVariants(page.bodyText + " " + page.title + " " + page.headings.join(" "), key, forms) - bodyExact;
  const density = densityPct(page.wordCount, bodyExact, wordsOf(key).length);

  const checks: KeywordCheck[] = [
    inTitle(page.title, key),
    inH1(page.h1, key),
    inFirstParagraph(page.bodyText, page.paragraphs, key),
    inH2s(page.h2, key),
    inMeta(page.metaDescription, key),
    stuffing(page, key, bodyExact, density),
    clustered(page.paragraphs, key),
    stuffedHeadings(page.headings, key),
  ];

  let score = 100;
  for (const check of checks) score += check.points;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    grade: gradeFor(score),
    density,
    exactCount: bodyExact,
    variantCount: Math.max(0, variantCount),
    checks,
  };
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "is", "are", "was", "were", "be", "been", "with", "this", "that", "these", "those", "your", "you", "from", "as", "at", "by", "it", "its", "we", "our", "they", "their", "not", "but", "if", "than", "then", "so", "can", "will", "just", "about", "into", "over", "after", "before", "also", "more", "most", "other", "some", "such", "only", "own", "same", "too", "very", "have", "has", "had", "do", "does", "did", "all", "any", "each", "few", "how", "what", "when", "where", "which", "who", "why",
]);

function inTitle(title: string, keyword: string): KeywordCheck {
  const ideal = "Main words appear in the title";
  if (!title) {
    return row("in-title", "In title", ideal, "error", "No title tag on this page.", "Add a title that includes the main words of the focus keyword.", ERROR_POINTS, "");
  }
  if (countExact(title, keyword) > 0) {
    return row("in-title", "In title", ideal, "pass", `“${keyword}” is in the title.`, null, 0, title);
  }
  const wanted = contentWords(keyword);
  const present = new Set(contentWords(title));
  const matched = wanted.filter((word) => present.has(word));
  if (wanted.length >= 3 && matched.length / wanted.length >= 0.5) {
    return row("in-title", "In title", ideal, "pass", `The title includes ${matched.length} of ${wanted.length} main words from “${keyword}”.`, null, 0, title);
  }
  return row("in-title", "In title", ideal, "error", `“${keyword}” is missing from the title.`, "Use the main words of the focus keyword in the title.", ERROR_POINTS, title);
}

function contentWords(value: string) {
  return wordsOf(normalize(value)).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function inH1(h1: string[], keyword: string): KeywordCheck {
  if (h1.length === 0) {
    return row("in-h1", "In H1", "Present", "error", "No H1 on this page.", "Add an H1 that includes the focus keyword.", ERROR_POINTS, "");
  }
  const hits = h1.filter((text) => countExact(text, keyword) > 0);
  if (hits.length === 0) {
    return row("in-h1", "In H1", "Present", "error", `“${keyword}” is missing from the H1.`, "Use the focus keyword in the H1.", ERROR_POINTS, h1.join("\n"));
  }
  return row("in-h1", "In H1", "Present", "pass", `The H1 includes “${keyword}”.`, null, 0, hits.join("\n"));
}

function inFirstParagraph(body: string, paragraphs: string[], keyword: string): KeywordCheck {
  const firstWords = wordsOf(body).slice(0, 100).join(" ");
  if (!firstWords) {
    return row("in-first-paragraph", "In first paragraph", "Within first 100 words", "warning", "No body text to search.", "Add an opening that uses the focus keyword in the first 100 words.", WARNING_POINTS, "");
  }
  if (countExact(firstWords, keyword) > 0) {
    return row("in-first-paragraph", "In first paragraph", "Within first 100 words", "pass", `“${keyword}” appears in the first 100 words.`, null, 0, paragraphs[0] ?? firstWords);
  }
  if (countExact(body, keyword) > 0) {
    return row(
      "in-first-paragraph",
      "In first paragraph",
      "Within first 100 words",
      "warning",
      `“${keyword}” appears later than the first 100 words.`,
      "Move one natural use of the focus keyword into the opening.",
      WARNING_POINTS,
      "",
    );
  }
  return row(
    "in-first-paragraph",
    "In first paragraph",
    "Within first 100 words",
    "warning",
    `“${keyword}” is missing from the opening.`,
    "Use the focus keyword once in the first 100 words.",
    WARNING_POINTS,
    "",
  );
}

function inH2s(h2: string[], keyword: string): KeywordCheck {
  if (h2.length === 0) {
    return row("in-h2s", "In H2s", "In at least one H2", "warning", "No H2 on this page.", "Add an H2 that covers the focus keyword.", WARNING_POINTS, "");
  }
  const hits = h2.filter((text) => countExact(text, keyword) > 0);
  if (hits.length === 0) {
    return row("in-h2s", "In H2s", "In at least one H2", "warning", `“${keyword}” is in no H2.`, "Use the focus keyword in at least one H2 that matches the topic.", WARNING_POINTS, "");
  }
  return row("in-h2s", "In H2s", "In at least one H2", "pass", `The focus keyword is in ${hits.length} H2${hits.length === 1 ? "" : "s"}.`, null, 0, hits.join("\n"));
}

function inMeta(meta: string, keyword: string): KeywordCheck {
  if (!meta) {
    return row("in-meta", "In meta description", "Present", "warning", "No meta description on this page.", "Write a meta description that includes the focus keyword.", WARNING_POINTS, "");
  }
  if (countExact(meta, keyword) === 0) {
    return row("in-meta", "In meta description", "Present", "warning", `“${keyword}” is missing from the meta description.`, "Include the focus keyword once in the meta description.", WARNING_POINTS, meta);
  }
  return row("in-meta", "In meta description", "Present", "pass", `The meta description includes “${keyword}”.`, null, 0, meta);
}

function stuffing(page: KeywordPage, keyword: string, bodyExact: number, density: number): KeywordCheck {
  const consecutive = consecutiveHits(page.paragraphs, keyword);
  const unnatural = (bodyExact >= 5 && density > 3) || bodyExact >= 8 || consecutive >= 4;
  if (unnatural) {
    return row(
      "keyword-stuffing",
      "Keyword stuffing",
      "Reads naturally",
      "error",
      `“${keyword}” is repeated unnaturally (${bodyExact} exact uses, ${density.toFixed(1)}% density).`,
      "Keep the exact phrase only where it reads naturally. Use variants in other places.",
      ERROR_POINTS,
      "",
    );
  }
  return row("keyword-stuffing", "Keyword stuffing", "Reads naturally", "pass", "The focus keyword is not stuffed.", null, 0, `${bodyExact} exact use${bodyExact === 1 ? "" : "s"} in the body.`);
}

function clustered(paragraphs: string[], keyword: string): KeywordCheck {
  const crowded = paragraphs
    .map((paragraph, index) => ({ index, count: countExact(paragraph, keyword), text: paragraph }))
    .filter((item) => item.count >= 3);
  if (crowded.length > 0) {
    return row(
      "clustered-use",
      "Clustered use",
      "Spread through the content",
      "warning",
      `${crowded.length} paragraph${crowded.length === 1 ? "" : "s"} use “${keyword}” 3 or more times.`,
      "Spread the focus keyword across sections instead of packing it into one paragraph.",
      WARNING_POINTS,
      crowded[0].text,
    );
  }
  return row("clustered-use", "Clustered use", "Spread through the content", "pass", "No paragraph uses the focus keyword 3 or more times.", null, 0, "");
}

function stuffedHeadings(headings: string[], keyword: string): KeywordCheck {
  if (headings.length === 0) {
    return row("stuffed-headings", "Stuffed headings", "Keyword in some headings", "pass", "There are no headings to stuff.", null, 0, "");
  }
  const hits = headings.filter((heading) => countExact(heading, keyword) > 0);
  const ratio = hits.length / headings.length;
  if (headings.length >= 3 && ratio >= 0.7) {
    return row(
      "stuffed-headings",
      "Stuffed headings",
      "Keyword in some headings",
      "warning",
      `The focus keyword is in ${hits.length} of ${headings.length} headings.`,
      "Keep the keyword in the H1 and the H2s that match it. Do not put it in almost every heading.",
      WARNING_POINTS,
      hits.join("\n"),
    );
  }
  return row(
    "stuffed-headings",
    "Stuffed headings",
    "Keyword in some headings",
    "pass",
    hits.length === 0 ? "The focus keyword is not overused in headings." : `The focus keyword is in ${hits.length} of ${headings.length} headings.`,
    null,
    0,
    "",
  );
}

function densityPct(wordCount: number, exactCount: number, keywordWords: number) {
  if (wordCount <= 0 || exactCount <= 0) return 0;
  return (exactCount * Math.max(1, keywordWords) * 100) / wordCount;
}

function consecutiveHits(paragraphs: string[], keyword: string) {
  let best = 0;
  let run = 0;
  for (const paragraph of paragraphs) {
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (countExact(sentence, keyword) > 0) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
  }
  return best;
}

function wordForms(keyword: string) {
  const base = normalize(keyword);
  const parts = wordsOf(base);
  const forms = new Set<string>([base]);
  for (const part of parts) {
    forms.add(part);
    forms.add(pluralize(part));
    forms.add(singularize(part));
    if (part.endsWith("ing") && part.length > 5) forms.add(part.slice(0, -3));
    if (part.endsWith("ed") && part.length > 4) forms.add(part.slice(0, -2));
  }
  if (parts.length > 1) {
    forms.add([...parts].reverse().join(" "));
  }
  return [...forms].filter(Boolean);
}

function countVariants(text: string, keyword: string, forms: string[]) {
  const exact = countExact(text, keyword);
  let total = exact;
  for (const form of forms) {
    if (normalize(form) === normalize(keyword)) continue;
    total += countExact(text, form);
  }
  total += reorderHits(text, keyword);
  return total;
}

function reorderHits(text: string, keyword: string) {
  const parts = wordsOf(keyword);
  if (parts.length < 2) return 0;
  const reversed = [...parts].reverse().join(" ");
  if (reversed === normalize(keyword)) return 0;
  return countExact(text, reversed);
}

function pluralize(word: string) {
  if (word.endsWith("y") && word.length > 2 && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (word.endsWith("s")) return word;
  return `${word}s`;
}

function singularize(word: string) {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes") || word.endsWith("ches") || word.endsWith("shes")) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function row(
  id: string,
  parameter: string,
  ideal: string,
  status: KeywordCheck["status"],
  found: string,
  fix: string | null,
  points: number,
  details: string,
): KeywordCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}
