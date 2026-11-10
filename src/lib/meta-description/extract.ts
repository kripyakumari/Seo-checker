import * as cheerio from "cheerio";
import { cleanText } from "@/lib/meta-title/extract";

export type ExtractedDescription = {
  descriptions: string[];
  description: string;
  descriptionCount: number;
  ogDescription: string | null;
  title: string;
  firstParagraph: string;
  challenge: boolean;
};

export function extractDescriptionData(html: string): ExtractedDescription {
  const $ = cheerio.load(html);
  const descriptions: string[] = [];
  $("meta").each((_, el) => {
    const name = (($(el).attr("name") || "") as string).toLowerCase();
    if (name !== "description") return;
    descriptions.push(cleanText($(el).attr("content")));
  });

  let ogDescription: string | null = null;
  $("meta").each((_, el) => {
    const key = (($(el).attr("property") || $(el).attr("name") || "") as string).toLowerCase();
    if (key !== "og:description") return;
    const content = cleanText($(el).attr("content"));
    if (content && !ogDescription) ogDescription = content;
  });

  let title = "";
  $("title").each((_, el) => {
    if (title) return;
    title = cleanText($(el).text());
  });

  const clone = cheerio.load(html);
  clone("script, style, noscript, template, svg, iframe, nav, footer, header, aside, form").remove();
  const article = clone("article").first();
  const main = clone("main").first();
  const root = article.length ? article : main.length ? main : clone("body");
  let firstParagraph = "";
  root.find("p").each((_, el) => {
    if (firstParagraph) return;
    if (clone(el).parents("p").length) return;
    const text = cleanText(clone(el).text());
    if (text) firstParagraph = text;
  });
  if (!firstParagraph) firstParagraph = cleanText(root.text()).slice(0, 280);

  const nonEmpty = descriptions.filter(Boolean);
  return {
    descriptions,
    description: nonEmpty[0] ?? "",
    descriptionCount: descriptions.length,
    ogDescription,
    title,
    firstParagraph,
    challenge: isChallenge(html),
  };
}

function isChallenge(html: string) {
  const sample = html.slice(0, 4000).toLowerCase();
  return sample.includes("cf-browser-verification") || sample.includes("cf-challenge") || sample.includes("/cdn-cgi/challenge-platform");
}
