import { countExact, normalize, wordsOf } from "./extract";
import type { KeywordCheck, KeywordEvaluation, KeywordPage } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;

export function evaluateKeyword(page: KeywordPage, keyword: string, secondary: string[]): KeywordEvaluation {
  const key = keyword.replace(/\s+/g, " ").trim();
  const forms = wordForms(key);
  const exactCount = countExact(page.bodyText, key) + countExact(page.title, key) + page.headings.reduce((sum, heading) => sum + countExact(heading, key), 0);
  const bodyExact = countExact(page.bodyText, key);
  const variantCount = countVariants(page.bodyText + " " + page.title + " " + page.headings.join(" "), key, forms) - bodyExact;
  const density = densityPct(page.wordCount, bodyExact, wordsOf(key).length);

  const checks: KeywordCheck[] = [
    pageSearchIntent(page),
    betterKeyword(),
    inTitle(page.title, key),
    inH1(page.h1, key),
    inFirstParagraph(page.bodyText, page.paragraphs, key),
    inH2s(page.h2, key),
    inMeta(page.metaDescription, key),
    inSlug(page.slug, key),
    inAlt(page.alts, key),
    stuffing(page, key, bodyExact, density),
    densityRow(density, bodyExact, page.wordCount),
    clustered(page.paragraphs, key),
    distribution(page.bodyText, key),
    stuffedHeadings(page.headings, key),
    synonyms(page, key, forms, bodyExact),
    wordFormsRow(key, forms, page),
    secondaryRow(secondary, page),
    relatedTerms(page, key),
    longTailPhrases(page, key),
    questionsOnPage(page),
    usageVsTop10(density, bodyExact, page.wordCount),
    intentConsistency(page, key),
    cannibalization(),
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

function betterKeyword(): KeywordCheck {
  return row(
    "better-keyword",
    "Better keyword",
    "Close variant with more volume or less difficulty",
    "info",
    "No close variant is suggested.",
    null,
    0,
    "A better keyword needs volume and difficulty from a keyword API.",
  );
}

function pageSearchIntent(page: KeywordPage): KeywordCheck {
  const intent = detectPageIntent(page);
  return row(
    "search-intent",
    "Search intent",
    "Shown: informational, commercial, transactional, navigational",
    "info",
    `This page reads as ${intent.label}.`,
    null,
    0,
    `Signals: ${intent.hits.slice(0, 8).join(", ") || "general content cues"}. Read from this page, not from a keyword API.`,
  );
}

function cannibalization(): KeywordCheck {
  return row(
    "cannibalization",
    "Cannibalization",
    "One page per keyword",
    "info",
    "Other pages on this site were not compared.",
    null,
    0,
    "A site crawl is required before this can warn about two pages targeting the same keyword.",
  );
}

function relatedTerms(page: KeywordPage, keyword: string): KeywordCheck {
  const keyParts = new Set(wordsOf(keyword));
  const counts = new Map<string, number>();
  for (const word of wordsOf(page.bodyText)) {
    if (word.length < 4 || STOP_WORDS.has(word) || keyParts.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  const found = top.length ? `Terms repeated on this page: ${top.join(", ")}.` : "No strong related topic words stood out in the body.";
  return row(
    "related-terms",
    "Related terms",
    "Uses terms common in top 10 pages",
    "info",
    found,
    null,
    0,
    "Top 10 pages are not connected, so a missing-term warning is not scored.",
  );
}

function longTailPhrases(page: KeywordPage, keyword: string): KeywordCheck {
  const needle = normalize(keyword);
  if (!needle) {
    return row("long-tail", "Long-tail phrases", "Covers relevant longer phrases", "info", "No focus keyword to check.", null, 0, "");
  }
  const sources = [...page.headings, ...page.paragraphs];
  const found: string[] = [];
  for (const source of sources) {
    const clean = source.replace(/\s+/g, " ").trim();
    if (!clean || !normalize(clean).includes(needle)) continue;
    if (wordsOf(clean).length >= wordsOf(keyword).length + 1) {
      found.push(clean.length > 90 ? `${clean.slice(0, 87)}…` : clean);
    }
    if (found.length >= 4) break;
  }
  if (found.length === 0) {
    return row(
      "long-tail",
      "Long-tail phrases",
      "Covers relevant longer phrases",
      "info",
      `No longer phrase including “${keyword}” was found on this page.`,
      null,
      0,
      "People Also Ask and autocomplete are not connected, so a coverage gap is not scored.",
    );
  }
  return row(
    "long-tail",
    "Long-tail phrases",
    "Covers relevant longer phrases",
    "info",
    `Found ${found.length} longer phrase${found.length === 1 ? "" : "s"} with the focus keyword on this page.`,
    null,
    0,
    `${found.join("\n")}\nPeople Also Ask and autocomplete are not connected, so this row is not scored.`,
  );
}

function questionsOnPage(page: KeywordPage): KeywordCheck {
  const headingQs = page.headings.filter((heading) => /\?/.test(heading) || /^(who|what|why|how|when|where|which)\b/i.test(heading.trim()));
  const bodyQs = page.paragraphs.filter((paragraph) => paragraph.includes("?"));
  const total = headingQs.length + bodyQs.length;
  if (total === 0) {
    return row(
      "questions",
      "Questions",
      "Answers top related questions",
      "info",
      "No question-style headings or question marks were found on this page.",
      null,
      0,
      "A list of top related questions is not connected, so this row is not scored.",
    );
  }
  const sample = [...headingQs, ...bodyQs.map((item) => (item.length > 90 ? `${item.slice(0, 87)}…` : item))].slice(0, 4);
  return row(
    "questions",
    "Questions",
    "Answers top related questions",
    "info",
    `Found ${total} question cue${total === 1 ? "" : "s"} on this page.`,
    null,
    0,
    sample.join("\n"),
  );
}

function usageVsTop10(density: number, bodyExact: number, wordCount: number): KeywordCheck {
  const uses = `${bodyExact} exact use${bodyExact === 1 ? "" : "s"}`;
  const measured = wordCount === 0 ? "This page has no body words to count." : `This page has ${uses} (${density.toFixed(1)}% of ${wordCount} words).`;
  return row(
    "usage-vs-top10",
    "Usage vs top 10",
    "Keyword count within the top pages' range",
    "info",
    measured,
    null,
    0,
    "Top-ranking pages are not connected, so a count far below or far above their range is not scored.",
  );
}

function intentConsistency(page: KeywordPage, keyword: string): KeywordCheck {
  const intent = detectPageIntent(page);
  const surface = normalize([page.title, page.h1.join(" "), page.metaDescription].join(" "));
  const aligned = intent.hits.some((hit) => surface.includes(normalize(hit))) || normalize(page.title).includes(normalize(keyword)) || page.h1.some((item) => normalize(item).includes(normalize(keyword)));
  return row(
    "intent-match",
    "Intent match",
    "Page type matches top results",
    "info",
    aligned ? `This page reads as ${intent.label}, and the title or H1 supports that.` : `This page reads as ${intent.label}. The title and H1 do not clearly say the same thing.`,
    null,
    0,
    "Top results are not connected, so a different page type is not scored as an error.",
  );
}

function detectPageIntent(page: KeywordPage): { label: string; hits: string[] } {
  const text = normalize([page.title, page.metaDescription, ...page.headings, page.bodyText.slice(0, 2500)].join(" "));
  const buckets: { label: string; cues: string[] }[] = [
    { label: "transactional", cues: ["buy now", "add to cart", "checkout", "order now", "purchase", "pricing", "price"] },
    { label: "commercial", cues: ["best", "vs", "review", "compare", "top", "alternative", "pricing"] },
    { label: "navigational", cues: ["login", "sign in", "contact us", "about us", "home"] },
    { label: "informational", cues: ["how to", "what is", "guide", "tips", "learn", "why", "examples"] },
  ];
  let best = { label: "informational", hits: [] as string[], score: 0 };
  for (const bucket of buckets) {
    const hits = bucket.cues.filter((cue) => text.includes(normalize(cue)));
    if (hits.length > best.score) best = { label: bucket.label, hits, score: hits.length };
  }
  return { label: best.label, hits: best.hits };
}

function inTitle(title: string, keyword: string): KeywordCheck {
  if (!title) {
    return row("in-title", "In title", "Present at the start or the end", "error", "No title tag on this page.", "Add a title that includes the focus keyword at the start or the end.", ERROR_POINTS, "");
  }
  const hits = countExact(title, keyword);
  if (hits === 0) {
    return row("in-title", "In title", "Present at the start or the end", "error", `“${keyword}” is missing from the title.`, "Put the focus keyword at the start or the end of the title.", ERROR_POINTS, title);
  }
  return row("in-title", "In title", "Present at the start or the end", "pass", `“${keyword}” is in the title.`, null, 0, title);
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

function inSlug(slug: string, keyword: string): KeywordCheck {
  if (!slug) {
    return row("in-slug", "In URL slug", "Present", "info", "This page has no slug (homepage).", null, 0, "A missing slug is info, so it does not change the score.");
  }
  const slugText = slug.replace(/[-_]+/g, " ");
  if (countExact(slugText, keyword) === 0 && !normalize(slugText).includes(normalize(keyword))) {
    return row("in-slug", "In URL slug", "Present", "info", `“${keyword}” is missing from the slug.`, null, 0, slug);
  }
  return row("in-slug", "In URL slug", "Present", "pass", `The slug includes “${keyword}”.`, null, 0, slug);
}

function inAlt(alts: string[], keyword: string): KeywordCheck {
  if (alts.length === 0) {
    return row("in-alt", "In image alt", "In at least one relevant alt", "info", "No image alt text on this page.", null, 0, "A missing alt is info, so it does not change the score.");
  }
  const hits = alts.filter((alt) => countExact(alt, keyword) > 0);
  if (hits.length === 0) {
    return row("in-alt", "In image alt", "In at least one relevant alt", "info", `“${keyword}” is in no image alt.`, null, 0, "");
  }
  return row("in-alt", "In image alt", "In at least one relevant alt", "pass", `The focus keyword is in ${hits.length} alt${hits.length === 1 ? "" : "s"}.`, null, 0, hits.slice(0, 3).join("\n"));
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

function densityRow(density: number, bodyExact: number, wordCount: number): KeywordCheck {
  const shown = wordCount === 0 ? "No body words to measure density." : `Density is ${density.toFixed(1)}% (${bodyExact} exact use${bodyExact === 1 ? "" : "s"} in ${wordCount} words). 1–2% is a common range.`;
  const note = density > 3.5 ? "This is far above a typical page, but density stays info and does not change the score. Stuffing is the scored check." : "Measured from this page’s body text. Density does not change the score.";
  return row("density", "Density", "Shown as % (1–2% is common)", "info", shown, null, 0, note);
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

function distribution(body: string, keyword: string): KeywordCheck {
  const words = wordsOf(body);
  if (countExact(body, keyword) === 0) {
    return row("distribution", "Distribution", "In intro, body and conclusion", "info", "The focus keyword is not in the body yet.", null, 0, "Distribution is info, so it does not change the score.");
  }
  if (words.length < 60) {
    return row(
      "distribution",
      "Distribution",
      "In intro, body and conclusion",
      "pass",
      "The page is short, so a full intro/body/conclusion split is not required.",
      null,
      0,
      "",
    );
  }
  const third = Math.floor(words.length / 3) || 1;
  const parts = [
    words.slice(0, third).join(" "),
    words.slice(third, third * 2).join(" "),
    words.slice(third * 2).join(" "),
  ];
  const hits = parts.map((part) => countExact(part, keyword) > 0);
  const labels = ["intro", "body", "conclusion"];
  const present = labels.filter((_, index) => hits[index]);
  if (hits[0] && !hits[1] && !hits[2]) {
    return row(
      "distribution",
      "Distribution",
      "In intro, body and conclusion",
      "info",
      "The focus keyword appears only in the first part of the page.",
      null,
      0,
      `Present in: ${present.join(", ") || "none"}`,
    );
  }
  return row(
    "distribution",
    "Distribution",
    "In intro, body and conclusion",
    "pass",
    `The focus keyword appears in ${present.join(", ")}.`,
    null,
    0,
    "",
  );
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

function synonyms(page: KeywordPage, keyword: string, forms: string[], bodyExact: number): KeywordCheck {
  const haystack = [page.title, page.metaDescription, ...page.headings, page.bodyText].join(" ");
  const variantHits = forms.filter((form) => form !== normalize(keyword) && countExact(haystack, form) > 0);
  const reordered = reorderHits(haystack, keyword);
  if (bodyExact >= 3 && variantHits.length === 0 && reordered === 0) {
    return row(
      "synonyms",
      "Synonyms and variants",
      "Natural variants used",
      "warning",
      "Only the exact focus phrase is repeated.",
      "Use a natural variant or reordered form in places where the exact phrase feels forced.",
      WARNING_POINTS,
      `Exact uses in body: ${bodyExact}`,
    );
  }
  if (variantHits.length > 0 || reordered > 0) {
    return row(
      "synonyms",
      "Synonyms and variants",
      "Natural variants used",
      "pass",
      `Natural variants are present${variantHits.length ? `: ${variantHits.slice(0, 4).join(", ")}` : ""}${reordered ? "; reordered forms found" : ""}.`,
      null,
      0,
      "",
    );
  }
  return row(
    "synonyms",
    "Synonyms and variants",
    "Natural variants used",
    "pass",
    "The exact phrase is not over-repeated, so variants are optional here.",
    null,
    0,
    "A synonym API is not used. Word forms and reordered phrases are checked on this page.",
  );
}

function wordFormsRow(keyword: string, forms: string[], page: KeywordPage): KeywordCheck {
  const haystack = [page.title, ...page.headings, page.bodyText].join(" ");
  const found = forms.filter((form) => countExact(haystack, form) > 0 || (wordsOf(form).length > 1 && normalize(haystack).includes(normalize(form))));
  const foundText = found.length === 0 ? `None of the expected forms were found yet (${forms.slice(0, 6).join(", ")}).` : `Counted forms on this page: ${found.slice(0, 8).join(", ")}.`;
  return row(
    "word-forms",
    "Word forms",
    "Singular, plural and reordered forms counted together",
    "info",
    foundText,
    null,
    0,
    "Word forms are counted with the focus keyword. This row does not change the score.",
  );
}

function secondaryRow(secondary: string[], page: KeywordPage): KeywordCheck {
  if (secondary.length === 0) {
    return row(
      "secondary-keywords",
      "Secondary keywords",
      "Each used at least once",
      "info",
      "No secondary keywords found on the page.",
      null,
      0,
      "Secondary terms come from H2 headings when present.",
    );
  }
  const haystack = [page.title, page.metaDescription, ...page.headings, page.bodyText].join(" ");
  const missing = secondary.filter((item) => countExact(haystack, item) === 0);
  if (missing.length > 0) {
    return row(
      "secondary-keywords",
      "Secondary keywords",
      "Each used at least once",
      "warning",
      `Missing: ${missing.join(", ")}.`,
      "Use each secondary keyword once where it fits naturally.",
      WARNING_POINTS,
      "",
    );
  }
  return row("secondary-keywords", "Secondary keywords", "Each used at least once", "pass", "Every secondary keyword appears at least once.", null, 0, secondary.join(", "));
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
