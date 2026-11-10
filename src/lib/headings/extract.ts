import * as cheerio from "cheerio";
import type { Element, ParentNode } from "domhandler";
import type { FoundHeading } from "./types";

export type HeadingExtract = {
  title: string;
  headings: FoundHeading[];
  /** Words before each heading, then the words after the last heading. */
  gaps: number[];
  wordCount: number;
};

export function extractHeadings(html: string): HeadingExtract {
  const $ = cheerio.load(html);
  const headings: FoundHeading[] = [];
  const gaps: number[] = [];
  let pending = 0;
  const root = $("body").get(0);
  if (root) walk($, root, headings, gaps, () => pending, (value) => {
    pending = value;
  });
  gaps.push(pending);

  let title = "";
  $("title").each((_, element) => {
    if (title || inSkipped(element)) return;
    title = clean($(element).text());
  });

  const wordCount = gaps.reduce((sum, count) => sum + count, 0) + headings.reduce((sum, heading) => sum + wordCountOf(heading.text), 0);
  return { title, headings, gaps, wordCount };
}

function walk(
  $: cheerio.CheerioAPI,
  node: Element,
  headings: FoundHeading[],
  gaps: number[],
  readPending: () => number,
  writePending: (value: number) => void,
) {
  for (const child of node.children ?? []) {
    if (child.type === "text") {
      writePending(readPending() + wordCountOf(child.data ?? ""));
      continue;
    }
    if (child.type !== "tag") continue;
    const name = child.name.toLowerCase();
    if (name === "script" || name === "style" || name === "noscript" || name === "template") continue;
    if (/^h[1-6]$/.test(name) && !inSkipped(child)) {
      gaps.push(readPending());
      writePending(0);
      headings.push(readHeading($, child, Number(name.slice(1))));
      continue;
    }
    walk($, child, headings, gaps, readPending, writePending);
  }
}

function readHeading($: cheerio.CheerioAPI, node: Element, level: number): FoundHeading {
  const own = clean($(node).clone().children().remove().end().text());
  const nested = clean($(node).text());
  const alt = $(node)
    .find("img[alt]")
    .toArray()
    .map((image) => clean($(image).attr("alt") ?? ""))
    .filter(Boolean)
    .join(" ");
  const text = nested || own || alt;
  const words = wordCountOf(text);
  const parent = node.parent;
  const parentIsButton = parent?.type === "tag" && parent.name.toLowerCase() === "button";
  const parentLink = parent?.type === "tag" && parent.name.toLowerCase() === "a" ? parent : null;
  const parentClass = (parentLink?.attribs.class ?? "").toLowerCase();
  return {
    level,
    text,
    empty: text.length === 0,
    hidden: isHidden(node),
    styled: parentIsButton || Boolean(parentLink && /btn|button/.test(parentClass)) || words >= 20,
  };
}

function isHidden(node: Element) {
  let current: Element | null = node;
  while (current && current.type === "tag") {
    const attribs = current.attribs ?? {};
    if ("hidden" in attribs || attribs["aria-hidden"] === "true") return true;
    const style = (attribs.style ?? "").toLowerCase();
    if (/display\s*:\s*none/.test(style) || /visibility\s*:\s*hidden/.test(style)) return true;
    const className = (attribs.class ?? "").toLowerCase();
    if (/(^|\s)(sr-only|visually-hidden|screen-reader-text)(\s|$)/.test(className)) return true;
    current = asTag(current.parent);
    if (current && (current.name === "body" || current.name === "html")) break;
  }
  return false;
}

function inSkipped(node: Element) {
  let parent = asTag(node.parent);
  while (parent) {
    const name = parent.name.toLowerCase();
    if (name === "svg" || name === "math") return true;
    parent = asTag(parent.parent);
  }
  return false;
}

function asTag(node: ParentNode | null): Element | null {
  return node && node.type === "tag" ? node : null;
}

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function wordCountOf(value: string) {
  const text = clean(value);
  return text ? text.split(" ").length : 0;
}
