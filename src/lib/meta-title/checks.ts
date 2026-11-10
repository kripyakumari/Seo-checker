import { measurePixels, DESKTOP_LIMIT, MOBILE_LIMIT } from "./pixels";
import type { Check, Evaluation } from "./types";

const STOP = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "our",
  "the",
  "to",
  "with",
  "your",
]);

export type EvaluateInput = {
  title: string;
  titleCount: number;
  h1: string | null;
  h1Count: number;
  ogTitle: string | null;
  keyword: string;
  brand: string;
};

export function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

export function evaluateTitle(input: EvaluateInput): Evaluation {
  const title = input.title;
  const brand = input.brand.trim().replace(/\s+/g, " ");
  const pixels = measurePixels(title);
  const characters = [...title].length;
  const words = title ? title.split(/\s+/).filter(Boolean).length : 0;
  const checks: Check[] = [];

  checks.push(titlePresent(title));
  checks.push(characterLength(characters));
  checks.push(desktopWidth(pixels.width));
  checks.push(mobileWidth(pixels.width));
  checks.push(brandPosition(title, brand));
  checks.push(separators(title));
  checks.push(allCaps(title));
  checks.push(emojiAndSymbols(title));
  checks.push(titleCount(input.titleCount));
  checks.push(titleVsOg(title, input.ogTitle));

  const uncapped = 100 + checks.reduce((sum, check) => sum + check.points, 0);
  const score = Math.max(0, Math.min(100, uncapped));
  const topIssues = checks
    .filter((check) => check.points < 0)
    .sort((a, b) => {
      if (a.points !== b.points) return a.points - b.points;
      if (a.status === b.status) return 0;
      return a.status === "error" ? -1 : 1;
    })
    .slice(0, 3);

  return {
    title,
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
    score,
    grade: gradeFor(score),
    uncapped,
    capped: uncapped > 100,
  };
}

function row(
  partial: Omit<Check, "badge"> & { badge?: string },
): Check {
  return {
    ...partial,
    badge: partial.badge ?? badgeFor(partial.status),
  };
}

function badgeFor(status: Check["status"]) {
  if (status === "pass") return "Pass";
  if (status === "warning") return "Warning";
  if (status === "error") return "Error";
  return "Skipped";
}

function titlePresent(title: string): Check {
  if (title) {
    return row({
      id: "titlePresent",
      parameter: "Title present",
      ideal: "1 non-empty title",
      status: "pass",
      found: "One non-empty title was found.",
      fix: null,
      points: 0,
    });
  }
  return row({
    id: "titlePresent",
    parameter: "Title present",
    ideal: "1 non-empty title",
    status: "error",
    found: "Missing or empty.",
    fix: "Add one title in the head that describes this page in about 50–60 characters.",
    points: -36,
  });
}

function characterLength(n: number): Check {
  const base = {
    id: "characterLength",
    parameter: "Character length",
    ideal: "50–60",
  };
  if (n >= 50 && n <= 60) {
    return row({
      ...base,
      status: "pass",
      found: `${n} characters.`,
      fix: null,
      points: 0,
    });
  }
  if (n < 30) {
    return row({
      ...base,
      status: "error",
      found: n === 0 ? "0 characters." : `${n} characters, under 30.`,
      fix: "Expand the title to 50–60 characters so it says what the page is about.",
      points: -20,
    });
  }
  if (n < 50) {
    return row({
      ...base,
      status: "warning",
      found: `${n} characters, in the 30–49 range.`,
      fix: "Add a few specific words so the title reaches 50–60 characters.",
      points: -8,
    });
  }
  return row({
    ...base,
    status: "warning",
    found: `${n} characters, over 60.`,
    fix: "Shorten the title to 50–60 characters so Google is less likely to cut or rewrite it.",
    points: -8,
  });
}

function desktopWidth(width: number): Check {
  if (width > DESKTOP_LIMIT) {
    return row({
      id: "desktopPixels",
      parameter: "Desktop pixel width",
      ideal: "< 600px",
      status: "error",
      found: `${width}px in Arial 20px, over 600px.`,
      fix: `Remove words until the title is under 600px wide. It is ${width}px now, and the preview marks the cut.`,
      points: -14,
    });
  }
  return row({
    id: "desktopPixels",
    parameter: "Desktop pixel width",
    ideal: "< 600px",
    status: "pass",
    found: `${width}px in Arial 20px.`,
    fix: null,
    points: 0,
  });
}

function mobileWidth(width: number): Check {
  if (width > MOBILE_LIMIT) {
    return row({
      id: "mobilePixels",
      parameter: "Mobile pixel width",
      ideal: "≤ 620px",
      status: "warning",
      found: `${width}px in Arial 20px, over 620px.`,
      fix: `Tighten the title to 620px or less for mobile. It is ${width}px now.`,
      points: -6,
    });
  }
  return row({
    id: "mobilePixels",
    parameter: "Mobile pixel width",
    ideal: "≤ 620px",
    status: "pass",
    found: `${width}px in Arial 20px.`,
    fix: null,
    points: 0,
  });
}

function brandPosition(title: string, brand: string): Check {
  const base = {
    id: "brandPosition",
    parameter: "Brand name",
    ideal: "At the start or the end",
  };
  if (!brand) {
    return row({
      ...base,
      status: "info",
      found: "The domain name could not be used as a brand.",
      fix: null,
      points: 0,
    });
  }
  const quoted = `“${brand}” from the domain`;
  const found = findBrand(title, brand);
  if (!found) {
    return row({
      ...base,
      status: "warning",
      found: `${quoted} was not found in the title.`,
      fix: `Add ${quoted} at the start or the end of the title.`,
      points: -6,
    });
  }
  const only = normalize(title) === normalize(brand.replace(/[-_.]+/g, " "));
  if (only) {
    return row({
      ...base,
      status: "warning",
      found: "The domain name is the entire title.",
      fix: `Add a descriptive phrase, and keep ${quoted} at the start or the end.`,
      points: -6,
    });
  }
  if (brandAtStart(title, brand)) {
    return row({
      ...base,
      status: "pass",
      found: `${quoted} is at the start.`,
      fix: null,
      points: 0,
    });
  }
  if (brandAtEnd(title, brand)) {
    return row({
      ...base,
      status: "pass",
      found: `${quoted} is at the end.`,
      fix: null,
      points: 0,
    });
  }
  return row({
    ...base,
    status: "warning",
    found: `${quoted} is in the middle.`,
    fix: `Move ${quoted} to the start or the end of the title.`,
    points: -6,
  });
}

function separators(title: string): Check {
  const used = new Set<string>();
  if (title.includes("|")) used.add("pipe");
  if (title.includes("–") || title.includes("—")) used.add("dash");
  if (/\s-\s/.test(title)) used.add("hyphen");
  if (title.includes("·") || title.includes("•")) used.add("dot");
  if (title.includes("»") || title.includes("›") || /\s>\s/.test(title)) used.add("angle");
  if (used.size <= 1) {
    return row({
      id: "separators",
      parameter: "Separators",
      ideal: "One style",
      status: "pass",
      found: used.size === 0 ? "No separator, so styles are not mixed." : `One style: ${[...used][0]}.`,
      fix: null,
      points: 0,
    });
  }
  return row({
    id: "separators",
    parameter: "Separators",
    ideal: "One style",
    status: "warning",
    found: `Mixed styles: ${[...used].join(" and ")}.`,
    fix: "Use only one separator. Pick either a pipe (|) or a hyphen (-), not both.",
    points: -4,
  });
}

function allCaps(title: string): Check {
  const shouted = title
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((word) => word.length >= 4 && /^\p{Lu}+$/u.test(word));
  if (shouted.length === 0) {
    return row({
      id: "allCaps",
      parameter: "ALL CAPS",
      ideal: "None",
      status: "pass",
      found: "No full-caps word of 4 or more letters.",
      fix: null,
      points: 0,
    });
  }
  const list = [...new Set(shouted)].slice(0, 4).join(", ");
  return row({
    id: "allCaps",
    parameter: "ALL CAPS",
    ideal: "None",
    status: "warning",
    found: `Full-caps ${shouted.length === 1 ? "word" : "words"}: ${list}.`,
    fix: `Rewrite ${list} in normal case. Short acronyms such as SEO can stay capped.`,
    points: -5,
  });
}

function emojiAndSymbols(title: string): Check {
  const problems: string[] = [];
  if (/\p{Extended_Pictographic}/u.test(title)) problems.push("an emoji");
  if (/!{2,}|\?{2,}/.test(title)) problems.push("repeated punctuation");
  if (/\${2,}/.test(title)) problems.push("$$$");
  if (/[★☆✓✔✕✖✪✩♥►▶●]/.test(title)) problems.push("a decorative symbol");
  if (problems.length === 0) {
    return row({
      id: "emoji",
      parameter: "Emoji / symbols",
      ideal: "None",
      status: "pass",
      found: "No emoji, !!!, or $$$.",
      fix: null,
      points: 0,
    });
  }
  return row({
    id: "emoji",
    parameter: "Emoji / symbols",
    ideal: "None",
    status: "warning",
    found: `Contains ${problems.join(" and ")}.`,
    fix: "Remove emoji and symbols such as !!! or $$$ from the title.",
    points: -6,
  });
}

function titleCount(count: number): Check {
  if (count === 1) {
    return row({
      id: "titleCount",
      parameter: "Title tag count",
      ideal: "Exactly 1",
      status: "pass",
      found: "Exactly 1 title tag.",
      fix: null,
      points: 0,
    });
  }
  return row({
    id: "titleCount",
    parameter: "Title tag count",
    ideal: "Exactly 1",
    status: "error",
    found: count === 0 ? "0 title tags." : `${count} title tags.`,
    fix:
      count === 0
        ? "Add exactly one title tag inside the head."
        : "Keep a single title tag and remove the extras so Google sees one title.",
    points: -18,
  });
}

function titleVsOg(title: string, ogTitle: string | null): Check {
  const base = {
    id: "titleVsOg",
    parameter: "Title vs og:title",
    ideal: "Roughly match",
  };
  if (!ogTitle) {
    return row({
      ...base,
      status: "warning",
      found: "No og:title was found.",
      fix: "Add an og:title that roughly matches the title tag.",
      points: -6,
    });
  }
  if (roughlyMatches(title, ogTitle)) {
    return row({
      ...base,
      status: "pass",
      found: "The og:title roughly matches the title.",
      fix: null,
      points: 0,
    });
  }
  return row({
    ...base,
    status: "warning",
    found: "The og:title is very different from the title.",
    fix: "Rewrite the og:title so it stays close to the title tag.",
    points: -6,
  });
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

function roughlyMatches(title: string, og: string) {
  const a = normalize(title);
  const b = normalize(og);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const left = new Set(tokens(title));
  const right = new Set(tokens(og));
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  const union = left.size + right.size - shared;
  return union > 0 && shared / union >= 0.45;
}

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandPattern(brand: string) {
  return brand
    .trim()
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((part) => escapeReg(part))
    .join("[\\s._-]+");
}

function findBrand(title: string, brand: string) {
  const pattern = brandPattern(brand);
  if (!pattern) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu").test(title);
}

function brandAtStart(title: string, brand: string) {
  const pattern = brandPattern(brand);
  if (!pattern) return false;
  return new RegExp(`^\\s*${pattern}(?![\\p{L}\\p{N}])`, "iu").test(title);
}

function brandAtEnd(title: string, brand: string) {
  const pattern = brandPattern(brand);
  if (!pattern) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}[\\s.,;:!?|–—\\-·»›>]*$`, "iu").test(title);
}
