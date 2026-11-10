import type { ReadabilityCheck, ReadabilityDocument, ReadabilityEvaluation } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;
const BASIC = new Set(["minimum-length", "flesch", "grade-level", "gunning-fog", "language"]);
const KEPT_WHEN_FOREIGN = new Set(["language"]);

export function evaluateReadability(input: ReadabilityDocument): ReadabilityEvaluation {
  const checks = [
    minimumLength(input),
    flesch(input),
    gradeLevel(input),
    fog(input),
    averageSentence(input),
    longSentences(input),
    veryLong(input),
    sameStart(input),
    passive(input),
    transitions(input),
    paragraphLength(input),
    wall(input),
    subheadings(input),
    opening(input),
    complex(input),
    filler(input),
    repeated(input),
    headings(input),
    emphasis(input),
    spelling(input),
    grammar(input),
    language(input),
  ];

  const scored = checks.map((check) => {
    if (input.foreign && !KEPT_WHEN_FOREIGN.has(check.id)) {
      return unscored(check, "Not scored. This text is not using the English formula, so the score was skipped.");
    }
    if (input.wordCount < 100 && !BASIC.has(check.id)) {
      return unscored(check, "Not scored. This text is under 100 words, so only the reading scores count.");
    }
    return check;
  });

  if (input.foreign) {
    return {
      score: null,
      grade: "Not scored",
      wordCount: input.wordCount,
      sentenceCount: input.sentenceCount,
      flesch: input.flesch,
      gradeLevel: input.gradeLevel,
      checks: scored,
    };
  }

  const score = clamp(100 + scored.reduce((sum, check) => sum + check.points, 0));
  return {
    score,
    grade: gradeFor(score),
    wordCount: input.wordCount,
    sentenceCount: input.sentenceCount,
    flesch: input.flesch,
    gradeLevel: input.gradeLevel,
    checks: scored,
  };
}

export function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function minimumLength(input: ReadabilityDocument): ReadabilityCheck {
  if (input.wordCount < 100) {
    return row("minimum-length", "Minimum text length", "100+ words", "info", `This text has ${input.wordCount} words. Under 100 words, the score is not reliable.`, null, 0, "Only the reading scores are counted.");
  }
  return row("minimum-length", "Minimum text length", "100+ words", "pass", `This text has ${input.wordCount} words.`, null, 0, "");
}

function flesch(input: ReadabilityDocument): ReadabilityCheck {
  if (input.flesch == null) return row("flesch", "Flesch Reading Ease", "60+ (general audience)", "info", "There are not enough sentences to calculate Flesch Reading Ease.", null, 0, "");
  const score = round1(input.flesch);
  if (input.flesch < 30) return row("flesch", "Flesch Reading Ease", "60+ (general audience)", "error", `Reading ease is ${score}. Under 30 is very hard for a general reader.`, "Shorten the sentences and use more common words.", ERROR_POINTS, "");
  if (input.flesch < 50) return row("flesch", "Flesch Reading Ease", "60+ (general audience)", "warning", `Reading ease is ${score}. Under 50 is harder than a general audience expects.`, "Shorten a few sentences and replace the hardest words.", WARNING_POINTS, "");
  return row("flesch", "Flesch Reading Ease", "60+ (general audience)", "pass", `Reading ease is ${score}.`, null, 0, "");
}

function gradeLevel(input: ReadabilityDocument): ReadabilityCheck {
  if (input.gradeLevel == null) return row("grade-level", "Grade level (Flesch-Kincaid)", "Grade 6–9", "info", "There are not enough sentences to calculate grade level.", null, 0, "");
  const grade = round1(input.gradeLevel);
  if (input.gradeLevel > 12) return row("grade-level", "Grade level (Flesch-Kincaid)", "Grade 6–9", "warning", `The grade level is ${grade}, above grade 12.`, "Use shorter sentences and simpler words so the grade falls.", WARNING_POINTS, "");
  return row("grade-level", "Grade level (Flesch-Kincaid)", "Grade 6–9", "pass", `The grade level is ${grade}.`, null, 0, "");
}

function fog(input: ReadabilityDocument): ReadabilityCheck {
  if (input.fog == null) return row("gunning-fog", "Gunning Fog index", "Under 12", "info", "There are not enough sentences to calculate the Gunning Fog index.", null, 0, "");
  const score = round1(input.fog);
  if (input.fog >= 12) return row("gunning-fog", "Gunning Fog index", "Under 12", "warning", `The Fog index is ${score}. 12 or above is hard to read.`, "Cut long sentences and words of 3 or more syllables.", WARNING_POINTS, "");
  return row("gunning-fog", "Gunning Fog index", "Under 12", "pass", `The Fog index is ${score}.`, null, 0, "");
}

function averageSentence(input: ReadabilityDocument): ReadabilityCheck {
  if (input.sentenceCount === 0) return row("average-sentence", "Average sentence length", "Under 20 words", "info", "There are no sentences to measure.", null, 0, "");
  const average = round1(input.averageSentence);
  if (input.averageSentence >= 20) return row("average-sentence", "Average sentence length", "Under 20 words", "warning", `The average sentence is ${average} words.`, "Split sentences so the average falls under 20 words.", WARNING_POINTS, "");
  return row("average-sentence", "Average sentence length", "Under 20 words", "pass", `The average sentence is ${average} words.`, null, 0, "");
}

function longSentences(input: ReadabilityDocument): ReadabilityCheck {
  const percent = Math.round(input.longShare * 100);
  if (input.sentenceCount > 0 && input.longShare >= 0.25) return row("long-sentences", "Long sentences", "Under 25% of sentences over 20 words", "warning", `${percent}% of sentences are over 20 words.`, "Rewrite the longest sentences so fewer than 1 in 4 run past 20 words.", WARNING_POINTS, "");
  return row("long-sentences", "Long sentences", "Under 25% of sentences over 20 words", "pass", input.sentenceCount === 0 ? "There are no sentences to measure." : `${percent}% of sentences are over 20 words.`, null, 0, "");
}

function veryLong(input: ReadabilityDocument): ReadabilityCheck {
  if (input.veryLong.length) return row("very-long", "Very long sentences", "None over 35 words", "error", `${input.veryLong.length} ${input.veryLong.length === 1 ? "sentence is" : "sentences are"} over 35 words.`, "Split any sentence that runs past 35 words.", ERROR_POINTS, input.veryLong.join("\n"));
  return row("very-long", "Very long sentences", "None over 35 words", "pass", "No sentence is over 35 words.", null, 0, "");
}

function sameStart(input: ReadabilityDocument): ReadabilityCheck {
  if (input.sameStart.length) return row("same-start", "Same start", "No 3+ sentences in a row starting with the same word", "warning", `3 or more sentences in a row start with ${input.sameStart.map((word) => `“${word}”`).join(", ")}.`, "Start the next sentence with a different word.", WARNING_POINTS, "");
  return row("same-start", "Same start", "No 3+ sentences in a row starting with the same word", "pass", "No 3 sentences in a row start with the same word.", null, 0, "");
}

function passive(input: ReadabilityDocument): ReadabilityCheck {
  const percent = Math.round(input.passiveShare * 100);
  if (input.sentenceCount > 0 && input.passiveShare >= 0.1) return row("passive", "Passive voice", "Under 10% of sentences", "warning", `${percent}% of sentences use a passive verb.`, "Name who does the action, so fewer than 1 in 10 sentences stay passive.", WARNING_POINTS, "");
  return row("passive", "Passive voice", "Under 10% of sentences", "pass", input.sentenceCount === 0 ? "There are no sentences to measure." : `${percent}% of sentences use a passive verb.`, null, 0, "");
}

function transitions(input: ReadabilityDocument): ReadabilityCheck {
  const percent = Math.round(input.transitionShare * 100);
  if (input.sentenceCount > 0 && input.transitionShare < 0.3) return row("transitions", "Transition words", "In 30%+ of sentences", "warning", `Transition words appear in ${percent}% of sentences.`, "Add a transition such as “for example”, “because”, or “however” so at least 30% of sentences have one.", WARNING_POINTS, "");
  return row("transitions", "Transition words", "In 30%+ of sentences", "pass", input.sentenceCount === 0 ? "There are no sentences to measure." : `Transition words appear in ${percent}% of sentences.`, null, 0, "");
}

function paragraphLength(input: ReadabilityDocument): ReadabilityCheck {
  if (input.longParagraphs.length) return row("paragraph-length", "Paragraph length", "Up to ~150 words or 3–4 sentences", "warning", `${input.longParagraphs.length} ${input.longParagraphs.length === 1 ? "paragraph is" : "paragraphs are"} over 150 words.`, "Break the paragraph before it passes 150 words.", WARNING_POINTS, input.longParagraphs.join("\n"));
  return row("paragraph-length", "Paragraph length", "Up to ~150 words or 3–4 sentences", "pass", "No paragraph is over 150 words.", null, 0, "");
}

function wall(input: ReadabilityDocument): ReadabilityCheck {
  if (input.walls.length) return row("wall-of-text", "Wall of text", "—", "error", `${input.walls.length} ${input.walls.length === 1 ? "paragraph is" : "paragraphs are"} over 300 words.`, "Split that block into shorter paragraphs.", ERROR_POINTS, input.walls.join("\n"));
  return row("wall-of-text", "Wall of text", "—", "pass", "No paragraph is over 300 words.", null, 0, "");
}

function subheadings(input: ReadabilityDocument): ReadabilityCheck {
  if (input.subheadingGap) return row("subheadings", "Subheading distribution", "A heading every ~300 words", "warning", "A stretch of 300 or more words has no subheading.", "Add a subheading before a 300-word stretch.", WARNING_POINTS, "");
  return row("subheadings", "Subheading distribution", "A heading every ~300 words", "pass", "No 300-word stretch is missing a subheading.", null, 0, "");
}

function opening(input: ReadabilityDocument): ReadabilityCheck {
  if (input.openingProblem) return row("opening", "Opening paragraph", "Answers the main question early", "warning", input.openingProblem, "Move the point into the first few sentences. Keep the opening to about 4 sentences or 100 words.", WARNING_POINTS, "");
  return row("opening", "Opening paragraph", "Answers the main question early", "pass", "The opening is not a long intro.", null, 0, "");
}

function complex(input: ReadabilityDocument): ReadabilityCheck {
  const percent = Math.round(input.complexShare * 100);
  if (input.wordCount > 0 && input.complexShare >= 0.1) return row("complex-words", "Complex words", "Under 10% (3+ syllables)", "warning", `${percent}% of words have 3 or more syllables.`, "Swap some long words for a shorter word with the same meaning.", WARNING_POINTS, "");
  return row("complex-words", "Complex words", "Under 10% (3+ syllables)", "pass", `${percent}% of words have 3 or more syllables.`, null, 0, "");
}

function filler(input: ReadabilityDocument): ReadabilityCheck {
  const percent = round1(input.fillerShare * 100);
  if (input.wordCount > 0 && input.fillerShare >= 0.02) return row("filler", "Filler words", "Few (very, really, basically, actually)", "warning", `${input.fillerCount} filler words, ${percent}% of the text.`, "Cut “very”, “really”, “basically”, and “actually” until they are under 2% of the words.", WARNING_POINTS, "");
  return row("filler", "Filler words", "Few (very, really, basically, actually)", "pass", `${input.fillerCount} filler words.`, null, 0, "");
}

function repeated(input: ReadabilityDocument): ReadabilityCheck {
  if (input.repeated.length) return row("repeated-words", "Repeated words", "Varied wording", "warning", `These words repeat close together: ${input.repeated.join(", ")}.`, "Use another word, or cut the repeat, when the same word appears 3 times in a short stretch.", WARNING_POINTS, "");
  return row("repeated-words", "Repeated words", "Varied wording", "pass", "No content word is repeated 3 times in a 40-word stretch.", null, 0, "");
}

function headings(input: ReadabilityDocument): ReadabilityCheck {
  if (input.wordCount >= 300 && input.headingCount === 0) return row("headings", "Headings", "Content split into clear sections", "warning", "This long page has no headings.", "Add headings so the page is split into sections.", WARNING_POINTS, "");
  return row("headings", "Headings", "Content split into clear sections", "pass", input.headingCount === 0 ? "This page is under 300 words, so headings are not required by this row." : `${input.headingCount} headings in the main text.`, null, 0, "");
}

function emphasis(input: ReadabilityDocument): ReadabilityCheck {
  if (input.emphasis) return row("emphasis", "Emphasis", "Bold used for key points only", "warning", input.emphasis, "Keep bold for a few key words, and cut extra CAPS and exclamation marks.", WARNING_POINTS, "");
  return row("emphasis", "Emphasis", "Bold used for key points only", "pass", "Bold, CAPS, and exclamation marks are not heavy.", null, 0, "");
}

function spelling(input: ReadabilityDocument): ReadabilityCheck {
  if (input.spelling.length) return row("spelling", "Spelling", "No errors", "warning", `Possible misspellings: ${input.spelling.join(", ")}.`, "Correct the spelling.", WARNING_POINTS, "");
  return row("spelling", "Spelling", "No errors", "pass", "No common misspelling from the checker list was found.", null, 0, "");
}

function grammar(input: ReadabilityDocument): ReadabilityCheck {
  if (input.grammar.length) return row("grammar", "Grammar", "No errors", "warning", input.grammar[0] ?? "A grammar mistake was found.", "Fix the repeated word, the a/an choice, or the capital letter.", WARNING_POINTS, input.grammar.join("\n"));
  return row("grammar", "Grammar", "No errors", "pass", "No repeated word, a/an mistake, or lowercase sentence start was found.", null, 0, "");
}

function language(input: ReadabilityDocument): ReadabilityCheck {
  if (input.foreign) return row("language", "Language support", "Score formula matches the language", "info", "This text is not scored with the English formula. The score is skipped.", null, 0, "Hindi, or text in Devanagari, is not given an English readability score.");
  return row("language", "Language support", "Score formula matches the language", "pass", "The English formula matches this text.", null, 0, "");
}

function unscored(check: ReadabilityCheck, found: string): ReadabilityCheck {
  return { ...check, status: "info", found, fix: null, points: 0, details: "" };
}

function row(id: string, parameter: string, ideal: string, status: ReadabilityCheck["status"], found: string, fix: string | null, points: number, details: string): ReadabilityCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
