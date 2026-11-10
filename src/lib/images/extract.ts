import * as cheerio from "cheerio";

export type FoundImage = {
  url: string;
  name: string;
  alt: string | null;
  altMissing: boolean;
  widthAttr: number | null;
  heightAttr: number | null;
  loading: string | null;
  responsive: boolean;
  modernSource: boolean;
  titleAttr: string | null;
  hasCaption: boolean;
  cssOnly: boolean;
  ogOnly: boolean;
  decorativeHint: boolean;
  inContent: boolean;
  aspectRatio: boolean;
  lazyOnly: boolean;
  jsLazy: boolean;
};

export type SchemaNote = {
  productOrArticle: boolean;
  hasImage: boolean;
};

const SKIP = /^(data|blob|javascript):/i;
const IMAGE_PATH = /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i;

export function extractImages(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const images: FoundImage[] = [];
  const seen = new Set<string>();

  $("img").each((_, element) => {
    const node = $(element);
    const srcAttr = (node.attr("src") ?? "").trim();
    const lazyRaw = node.attr("data-src") || node.attr("data-lazy") || node.attr("data-lazy-src") || node.attr("data-original") || firstSrcsetUrl(node.attr("data-srcset"));
    const srcUsable = Boolean(srcAttr) && !SKIP.test(srcAttr);
    const raw = srcUsable ? srcAttr : lazyRaw || firstSrcsetUrl(node.attr("srcset"));
    const absolute = absoluteUrl(raw, pageUrl);
    if (!absolute) return;
    const key = stripHash(absolute);
    if (seen.has(key)) return;
    seen.add(key);

    const picture = node.parents("picture").first();
    const sourceSet = picture.length ? picture.find("source").toArray().map((source) => $(source)) : [];
    const srcset = [node.attr("srcset") ?? "", ...sourceSet.map((source) => source.attr("srcset") ?? "")].join(",");
    const modernSource = sourceSet.some((source) => /image\/(webp|avif)/i.test(source.attr("type") ?? "")) || /\.(webp|avif)(\?|#|$)/i.test(srcset);
    const altAttr = node.attr("alt");
    const figure = node.parents("figure").first();
    const classId = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
    const role = (node.attr("role") ?? "").toLowerCase();
    const style = node.attr("style") ?? "";

    images.push({
      url: absolute,
      name: fileName(absolute),
      alt: altAttr === undefined ? null : altAttr,
      altMissing: altAttr === undefined,
      widthAttr: readLength(node.attr("width")),
      heightAttr: readLength(node.attr("height")),
      loading: (node.attr("loading") ?? "").toLowerCase() || null,
      responsive: Boolean(node.attr("sizes")) || sourceSet.length > 0 || hasResponsiveSrcset(srcset),
      modernSource,
      titleAttr: node.attr("title") ?? null,
      hasCaption: figure.length > 0 && figure.find("figcaption").text().trim().length > 0,
      cssOnly: false,
      ogOnly: false,
      decorativeHint:
        node.attr("aria-hidden") === "true" ||
        role === "presentation" ||
        role === "none" ||
        /(^|[^a-z])(icon|sprite|spacer|pixel|bullet|arrow|chevron)([^a-z]|$)/i.test(classId),
      inContent: node.parents("nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']").length === 0,
      aspectRatio: /aspect-ratio\s*:/i.test(style),
      lazyOnly: !srcUsable && Boolean(lazyRaw),
      jsLazy: /(^|[^a-z])(lazyload|lozad|lazy)([^a-z]|$)/i.test(classId) || Boolean(lazyRaw),
    });
  });

  $("meta[property='og:image'], meta[property='og:image:url'], meta[property='og:image:secure_url'], meta[name='og:image']").each((_, element) => {
    const absolute = absoluteUrl($(element).attr("content"), pageUrl);
    if (!absolute) return;
    const key = stripHash(absolute);
    if (seen.has(key)) return;
    seen.add(key);
    images.push({
      url: absolute,
      name: fileName(absolute),
      alt: null,
      altMissing: false,
      widthAttr: null,
      heightAttr: null,
      loading: null,
      responsive: false,
      modernSource: false,
      titleAttr: null,
      hasCaption: false,
      cssOnly: false,
      ogOnly: true,
      decorativeHint: false,
      inContent: false,
      aspectRatio: false,
      lazyOnly: false,
      jsLazy: false,
    });
  });

  const css = cssUrls(html);
  for (const raw of css) {
    const absolute = absoluteUrl(raw, pageUrl);
    if (!absolute || !IMAGE_PATH.test(absolute)) continue;
    const key = stripHash(absolute);
    if (seen.has(key)) continue;
    seen.add(key);
    images.push({
      url: absolute,
      name: fileName(absolute),
      alt: null,
      altMissing: false,
      widthAttr: null,
      heightAttr: null,
      loading: null,
      responsive: false,
      modernSource: false,
      titleAttr: null,
      hasCaption: false,
      cssOnly: true,
      ogOnly: false,
      decorativeHint: true,
      inContent: false,
      aspectRatio: false,
      lazyOnly: false,
      jsLazy: false,
    });
  }

  return { images, schemas: readSchemas($) };
}

export function readSchemaNote(schemas: unknown[]): SchemaNote {
  let productOrArticle = false;
  let hasImage = false;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    const rawType = record["@type"];
    const types = (Array.isArray(rawType) ? rawType : rawType ? [rawType] : []).map((item) => String(item));
    if (types.some((type) => type === "Product" || type === "Article" || type === "NewsArticle" || type === "BlogPosting")) {
      productOrArticle = true;
      if (record.image) hasImage = true;
    }
    if (record["@graph"]) visit(record["@graph"]);
  };
  schemas.forEach(visit);
  return { productOrArticle, hasImage };
}

export function cssUrls(html: string) {
  const found: string[] = [];
  const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  const styles = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  const inline = html.match(/\sstyle\s*=\s*(['"])[\s\S]*?\1/gi) ?? [];
  for (const block of [...styles, ...inline]) {
    for (const match of block.matchAll(pattern)) found.push(match[2]);
  }
  return found;
}

function readSchemas($: ReturnType<typeof cheerio.load>) {
  const schemas: unknown[] = [];
  $("script[type='application/ld+json']").each((_, element) => {
    const text = $(element).text().trim();
    if (!text) return;
    try {
      schemas.push(JSON.parse(text));
    } catch {
      /* ignore broken JSON-LD */
    }
  });
  return schemas;
}

function absoluteUrl(raw: string | undefined, pageUrl: string) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || SKIP.test(value)) return null;
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
}

function firstSrcsetUrl(srcset: string | undefined) {
  if (!srcset) return undefined;
  return srcset.split(",")[0]?.trim().split(/\s+/)[0];
}

function hasResponsiveSrcset(srcset: string) {
  return /\s+\d+w\b|\s+\d+(?:\.\d+)?x\b/i.test(srcset) || srcset.split(",").filter((part) => part.trim()).length > 1;
}

function readLength(value: string | undefined) {
  if (!value) return null;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function fileName(url: string) {
  try {
    const path = new URL(url).pathname;
    const name = path.split("/").pop() || "image";
    return decodeURIComponent(name);
  } catch {
    return "image";
  }
}

function stripHash(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
