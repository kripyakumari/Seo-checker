import * as cheerio from "cheerio";

export type ExtractedTitle = {
  titles: string[];
  title: string;
  h1: string | null;
  h1Count: number;
  ogTitle: string | null;
  metaDescription: string | null;
  challenge: boolean;
};

type WithParent = {
  type?: string;
  name?: string;
  parent?: WithParent | null;
};

export function cleanText(value: string | null | undefined) {
  if (!value) return "";
  let text = value.replace(/\u00a0/g, " ").replace(/[\u200b-\u200d\ufeff]/g, "");
  for (let pass = 0; pass < 2; pass += 1) {
    if (!text.includes("&")) break;
    text = text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, num: string) => safeCode(Number(num)));
  }
  return text.replace(/\s+/g, " ").trim();
}

function safeCode(code: number) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function insideForeign(el: WithParent) {
  let node = el.parent;
  while (node) {
    if (node.type === "tag" && (node.name === "svg" || node.name === "math")) return true;
    node = node.parent;
  }
  return false;
}

export function extractTitleData(html: string): ExtractedTitle {
  const $ = cheerio.load(html);
  const titles: string[] = [];
  $("title").each((_, el) => {
    if (insideForeign(el)) return;
    titles.push(cleanText($(el).text()));
  });

  const h1Texts: string[] = [];
  $("h1").each((_, el) => {
    if (insideForeign(el)) return;
    const text = cleanText($(el).text());
    if (text) h1Texts.push(text);
  });
  const h1 = h1Texts[0] ?? null;

  const meta: { ogTitle: string | null; description: string | null } = { ogTitle: null, description: null };
  $("meta").each((_, el) => {
    const node = $(el);
    const key = (node.attr("property") || node.attr("name") || "").toLowerCase();
    const content = cleanText(node.attr("content"));
    if (!content) return;
    if (key === "og:title" && !meta.ogTitle) meta.ogTitle = content;
    if (key === "description" && !meta.description) meta.description = content;
  });

  const title = (titles[0] ?? "").slice(0, 500);
  const sample = html.slice(0, 20_000).toLowerCase();
  const challenge =
    sample.includes("cf-browser-verification") ||
    sample.includes("cf-challenge") ||
    sample.includes("/cdn-cgi/challenge-platform") ||
    (title.toLowerCase().includes("just a moment") && sample.includes("cloudflare"));

  return {
    titles: titles.map((item) => item.slice(0, 500)),
    title,
    h1: h1 ? h1.slice(0, 500) : null,
    h1Count: h1Texts.length,
    ogTitle: meta.ogTitle ? meta.ogTitle.slice(0, 500) : null,
    metaDescription: meta.description ? meta.description.slice(0, 500) : null,
    challenge,
  };
}
