export function syllables(word: string) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return 1;
  if (cleaned.length <= 3) return 1;
  let work = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  work = work.replace(/^y/, "");
  if (!work) work = cleaned;
  const groups = work.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}
