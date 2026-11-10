import * as cheerio from "cheerio";
import { syllables } from "./syllables";
import type { ReadabilityBlock, ReadabilityDocument, ReadabilityLanguage } from "./types";

const TEXT_CAP = 80_000;

const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "by", "at", "from", "our", "your", "you", "about", "is", "are", "was", "were", "be", "been", "it", "this", "that", "as", "if", "but", "not", "we", "they", "their", "its", "into", "over", "after", "before"]);
const BE = new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);
const PASSIVE_ADJECTIVE = new Set(["interested", "excited", "tired", "married", "concerned", "supposed", "related", "complicated", "detailed", "advanced", "united", "naked", "wicked", "rugged", "beloved", "sacred", "learned"]);
const IRREGULAR = new Set(["gone", "done", "seen", "made", "known", "taken", "given", "written", "found", "told", "shown", "built", "sent", "left", "held", "kept", "paid", "said", "thought", "brought", "bought", "caught", "taught", "felt", "heard", "meant", "met", "led", "read", "run", "come", "become", "begun", "chosen", "driven", "eaten", "fallen", "forgotten", "gotten", "grown", "hidden", "hurt", "lost", "put", "sold", "spoken", "spent", "stood", "understood", "worn", "won", "broken", "drawn", "flown", "frozen", "proven", "risen", "shaken", "stolen", "sworn", "woken"]);
const TRANSITIONS = ["for example", "for instance", "in addition", "as a result", "in contrast", "in other words", "in fact", "of course", "in particular", "that is", "however", "therefore", "finally", "also", "because", "then", "next", "meanwhile", "although", "though", "since", "while", "yet", "instead", "similarly", "likewise", "furthermore", "moreover", "consequently", "first", "second"];
const FILLER = new Set(["very", "really", "basically", "actually"]);
const MISSPELLINGS = ["seperate", "recieve", "definately", "occuring", "occured", "accomodate", "adress", "alot", "arguement", "begining", "beleive", "calender", "comming", "concensus", "definate", "enviroment", "existance", "experiance", "fourty", "freind", "gaurd", "grammer", "harrass", "independant", "knowlege", "lisence", "mispell", "neccessary", "noticable", "occurence", "persistant", "priviledge", "publically", "reccomend", "refered", "relevent", "restaraunt", "seige", "sieze", "sucess", "sucessful", "tendancy", "tommorow", "truely", "untill", "wellcome", "wierd", "writting"];

export function extractFromHtml(html: string, language: ReadabilityLanguage): ReadabilityDocument {
  const $ = cheerio.load(html);
  $("script, style, noscript, template, svg, iframe, nav, footer, header, aside, form, pre, code").remove();
  $("[role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']").remove();
  $("ins.adsbygoogle, #google_ads").remove();
  $("[id*='advert'], [id*='Advert'], [class*='advert'], [class*='Advert']").remove();

  const article = $("article").first();
  const main = $("main").first();
  const root = article.length ? article : main.length ? main : $("body");
  const blocks: ReadabilityBlock[] = [];
  root.find("p, li, blockquote, h1, h2, h3, h4, h5, h6").each((_, element) => {
    const tag = element.name.toLowerCase();
    if ($(element).parents("p, li, blockquote, h1, h2, h3, h4, h5, h6").length) return;
    const clone = $(element).clone();
    if (!/^h[1-6]$/.test(tag)) clone.find("h1, h2, h3, h4, h5, h6").remove();
    const text = clean(clone.text());
    if (!text) return;
    const level = /^h[1-6]$/.test(tag) ? Number(tag.slice(1)) : 0;
    const kind = tag === "li" ? "li" : tag === "blockquote" ? "quote" : level ? "h" : "p";
    blocks.push({ kind, level, text });
  });

  let boldWords = 0;
  root.find("strong, b").each((_, element) => {
    if ($(element).parents("strong, b").length) return;
    boldWords += wordsOf($(element).text()).length;
  });
  const plain = clean(root.text());
  return measure(blocks, { language, plain, boldWords });
}

export function extractFromText(raw: string, language: ReadabilityLanguage): ReadabilityDocument {
  const text = raw.slice(0, TEXT_CAP);
  const blocks: ReadabilityBlock[] = [];
  const chunks = text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean);
  for (const chunk of chunks.length ? chunks : [text.trim()]) {
    const lines = chunk.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const listed = lines.length > 0 && lines.every((line) => /^([-*]|\d+[.)])\s+\S/.test(line));
    if (listed) {
      for (const line of lines) blocks.push({ kind: "li", level: 0, text: line.replace(/^([-*]|\d+[.)])\s+/, "") });
      continue;
    }
    blocks.push({ kind: "p", level: 0, text: lines.join(" ") });
  }
  return measure(blocks.filter((block) => block.text.trim()), { language, plain: text, boldWords: 0 });
}

function measure(
  blocks: ReadabilityBlock[],
  extra: { language: ReadabilityLanguage; plain: string; boldWords: number },
): ReadabilityDocument {
  const paragraphBlocks = blocks.filter((block) => block.kind !== "h");
  const sentences = paragraphBlocks.flatMap((block) => sentencesOf(block.text).map((text) => ({ text, kind: block.kind })));
  const sentenceWords = sentences.map((sentence) => wordsOf(sentence.text));
  const allWords = blocks.flatMap((block) => wordsOf(block.text));
  const wordCount = allWords.length;
  const sentenceCount = sentences.length;
  const lengths = sentenceWords.map((words) => words.length);
  const sentenceWordTotal = lengths.reduce((sum, count) => sum + count, 0);
  const latin = allWords.filter((word) => /[A-Za-z]/.test(word));
  const syllableTotal = latin.reduce((sum, word) => sum + syllables(word), 0);
  const complexWords = latin.filter((word) => syllables(word) >= 3).length;
  const canScore = sentenceCount > 0 && latin.length > 0;
  const wordsPerSentence = canScore ? sentenceWordTotal / sentenceCount : 0;
  const syllablesPerWord = canScore ? syllableTotal / latin.length : 0;
  const flesch = canScore ? 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord : null;
  const gradeLevel = canScore ? 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59 : null;
  const fog = canScore ? 0.4 * (wordsPerSentence + 100 * (complexWords / latin.length)) : null;

  const veryLong = sentences.filter((_, index) => lengths[index] > 35).slice(0, 5).map((sentence) => clip(sentence.text));
  const longCount = lengths.filter((count) => count > 20).length;
  const firstWords = sentences.map((sentence) => wordsOf(sentence.text)[0]?.toLowerCase() ?? "");
  const sameStart: string[] = [];
  let run = 1;
  for (let index = 1; index < firstWords.length; index += 1) {
    if (firstWords[index] && firstWords[index] === firstWords[index - 1]) {
      run += 1;
      if (run === 3) sameStart.push(firstWords[index]);
    } else {
      run = 1;
    }
  }

  const passiveCount = sentences.filter((sentence) => isPassive(sentence.text)).length;
  const transitionCount = sentences.filter((sentence) => hasTransition(sentence.text)).length;
  const longParagraphs = paragraphBlocks.filter((block) => wordsOf(block.text).length > 150).slice(0, 3).map((block) => clip(block.text));
  const walls = paragraphBlocks.filter((block) => wordsOf(block.text).length > 300).slice(0, 3).map((block) => clip(block.text));
  const headingCount = blocks.filter((block) => block.kind === "h").length;
  let sinceSubhead = 0;
  let subheadingGap = false;
  for (const block of blocks) {
    if (block.kind === "h" && block.level >= 2) {
      if (sinceSubhead >= 300) subheadingGap = true;
      sinceSubhead = 0;
      continue;
    }
    sinceSubhead += wordsOf(block.text).length;
  }
  if (sinceSubhead >= 300 && headingCount > 0) subheadingGap = true;
  if (headingCount === 0) subheadingGap = false;

  const opening = paragraphBlocks[0];
  const openingWords = opening ? wordsOf(opening.text).length : 0;
  const openingSentences = opening ? sentencesOf(opening.text).length : 0;
  const openingProblem = opening && (openingSentences > 4 || openingWords > 100)
    ? `The opening has ${openingSentences} ${openingSentences === 1 ? "sentence" : "sentences"} and ${openingWords} words.`
    : null;

  const lowerWords = allWords.map((word) => word.toLowerCase());
  const fillerCount = lowerWords.filter((word) => FILLER.has(word)).length;
  const repeated = repeatedWords(lowerWords);
  const letters = [...extra.plain.matchAll(/\p{L}/gu)].map((match) => match[0]);
  const devanagari = letters.filter((letter) => /\p{Script=Devanagari}/u.test(letter)).length;
  const foreign = extra.language === "hi" || (letters.length > 0 && devanagari / letters.length >= 0.3);

  return {
    wordCount,
    sentenceCount,
    flesch,
    gradeLevel,
    fog,
    averageSentence: sentenceCount ? sentenceWordTotal / sentenceCount : 0,
    longShare: sentenceCount ? longCount / sentenceCount : 0,
    veryLong,
    sameStart: [...new Set(sameStart)],
    passiveShare: sentenceCount ? passiveCount / sentenceCount : 0,
    transitionShare: sentenceCount ? transitionCount / sentenceCount : 0,
    longParagraphs,
    walls,
    subheadingGap,
    openingProblem,
    complexShare: wordCount ? complexWords / wordCount : 0,
    fillerCount,
    fillerShare: wordCount ? fillerCount / wordCount : 0,
    repeated,
    emphasis: emphasisNote(extra.plain, extra.boldWords, wordCount),
    spelling: [...new Set(lowerWords.filter((word) => MISSPELLINGS.includes(word)))],
    grammar: grammarIssues(extra.plain, sentences.filter((sentence) => sentence.kind === "p" || sentence.kind === "quote").map((sentence) => sentence.text)),
    foreign,
    headingCount,
  };
}

function sentencesOf(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => wordsOf(part).length > 0);
}

function wordsOf(text: string) {
  return text.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string) {
  const text = clean(value);
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function isPassive(text: string) {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  for (let index = 0; index < words.length; index += 1) {
    if (!BE.has(words[index] ?? "")) continue;
    const next = words[index + 1];
    const after = words[index + 2];
    if (next && isParticiple(next)) return true;
    if (next && after && !BE.has(next) && isParticiple(after)) return true;
  }
  return false;
}

function isParticiple(word: string) {
  const bare = word.replace(/[^a-z]/g, "");
  if (!bare || PASSIVE_ADJECTIVE.has(bare)) return false;
  if (IRREGULAR.has(bare)) return true;
  return bare.length > 3 && bare.endsWith("ed");
}

function hasTransition(text: string) {
  const lower = ` ${text.toLowerCase()} `;
  return TRANSITIONS.some((phrase) => lower.includes(` ${phrase} `) || new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "iu").test(text));
}

function repeatedWords(words: string[]) {
  const found = new Set<string>();
  for (let start = 0; start < words.length; start += 1) {
    const window = words.slice(start, start + 40);
    const counts = new Map<string, number>();
    for (const word of window) {
      if (word.length < 4 || STOP.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (const [word, count] of counts) {
      if (count >= 3) found.add(word);
    }
  }
  return [...found].slice(0, 8);
}

function emphasisNote(text: string, boldWords: number, wordCount: number) {
  const notes: string[] = [];
  if (wordCount > 0 && boldWords / wordCount > 0.1) notes.push(`Bold covers ${Math.round((boldWords / wordCount) * 100)}% of the words.`);
  const caps = text.match(/\b[A-Z]{4,}\b/g)?.length ?? 0;
  if (caps >= 3) notes.push(`${caps} words are in ALL CAPS.`);
  const bangs = text.match(/!/g)?.length ?? 0;
  if (bangs >= 3) notes.push(`The text uses ${bangs} exclamation marks.`);
  return notes.length ? notes.join(" ") : null;
}

function grammarIssues(text: string, sentences: string[]) {
  const issues: string[] = [];
  const repeated = text.match(/\b([A-Za-z]{3,})\s+\1\b/i);
  if (repeated) issues.push(`The word “${repeated[1]}” is repeated.`);
  const lowered = sentences.find((sentence) => /^[a-z]/.test(sentence.trim()));
  if (lowered) issues.push("A sentence starts with a lowercase letter.");
  if (/\b(?:should|could|would)\s+of\b/i.test(text)) issues.push("Use “have”, not “of”, after should, could, or would.");
  for (const match of text.matchAll(/\b(a|an)\s+([A-Za-z]+)/gi)) {
    const article = match[1]?.toLowerCase();
    const next = match[2]?.toLowerCase() ?? "";
    if (!article || !next) continue;
    if (article === "a" && needsAn(next)) {
      issues.push(`Use “an” before “${match[2]}”.`);
      break;
    }
    if (article === "an" && !needsAn(next)) {
      issues.push(`Use “a” before “${match[2]}”.`);
      break;
    }
  }
  return issues.slice(0, 4);
}

function needsAn(word: string) {
  if (/^(uni|use|one|once|eu)/.test(word)) return false;
  if (/^u[^aeiou]/.test(word)) return false;
  if (/^(hour|honest|honour|honor|heir)/.test(word)) return true;
  return /^[aeiou]/.test(word);
}
