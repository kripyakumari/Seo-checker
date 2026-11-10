import type { MeasuredImage } from "./probe";
import type { CheckStatus, ImageCheck, ImageEvaluation, ImageRow } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;
const KB = 1024;
const MB = 1024 * 1024;
const GENERIC_ALT = new Set(["image", "img", "photo", "picture", "pic", "graphic", "banner", "placeholder", "untitled"]);

export type { MeasuredImage };

type CheckInput = {
  images: MeasuredImage[];
  keyword: string;
  robotsBlocked: Set<string>;
  pageHttps: boolean;
};

export function evaluateImages(input: CheckInput): ImageEvaluation {
  const hero = input.images.find((image) => isRealImage(image) && !skipAltAndSize(image)) ?? null;
  const altCounts = new Map<string, number>();
  for (const image of input.images.filter((item) => isContentImage(item))) {
    const key = altKey(image.alt);
    if (!key) continue;
    altCounts.set(key, (altCounts.get(key) ?? 0) + 1);
  }

  const imageRows = input.images.map((image, index) =>
    scoreImage(image, index, {
      hero: hero === image,
      altCounts,
      keyword: input.keyword,
    }),
  );

  const counted = input.images.filter((image) => countsTowardWeight(image));
  const totalBytes = counted.reduce((sum, image) => sum + (image.bytes ?? 0), 0);
  const pageChecks: ImageCheck[] = [];

  if (input.images.length === 0) {
    pageChecks.push(check("images-found", "Images found", "info", "No images on this page.", null, 0));
  }

  const below = input.images.filter((image) => isRealImage(image) && !skipAltAndSize(image) && image !== hero);
  if (below.length === 0) {
    pageChecks.push(check("lazy-loading", "Lazy loading", "pass", "There are no images below the top image.", null, 0));
  } else if (below.every((image) => !isLazy(image))) {
    pageChecks.push(
      check(
        "lazy-loading",
        "Lazy loading",
        "info",
        "Images below the top one all load at once.",
        "Add loading=\"lazy\" on images below the fold. This does not lower the score.",
        0,
      ),
    );
  } else {
    pageChecks.push(check("lazy-loading", "Lazy loading", "pass", "Images below the top one use lazy loading.", null, 0));
  }

  const scored = imageRows.filter((row) => row.scored);
  const average = scored.length === 0 ? 100 : scored.reduce((sum, row) => sum + row.score, 0) / scored.length;
  const pagePoints = pageChecks.reduce((sum, item) => sum + item.points, 0);
  const score = input.images.length === 0 ? 100 : clamp(Math.round(average + pagePoints));
  const grade = input.images.length === 0 ? "No images" : gradeFor(score);
  return {
    score,
    grade,
    contentCount: input.images.filter((image) => isRealImage(image) && !isPixel(image)).length,
    listedCount: imageRows.length,
    totalBytes,
    checks: pageChecks,
    images: imageRows,
  };
}

function scoreImage(
  image: MeasuredImage,
  index: number,
  context: { hero: boolean; altCounts: Map<string, number>; keyword: string },
): ImageRow {
  const checks: ImageCheck[] = [];
  const tiny = skipAltAndSize(image);
  const real = isRealImage(image);

  if (image.fetchError) {
    checks.push(check("broken", "Broken images", "info", "The image could not be read, so it was not scored as broken.", null, 0));
  } else if (image.statusCode !== null && image.statusCode >= 400) {
    checks.push(
      check("broken", "Broken images", "error", `The image returned HTTP ${image.statusCode}.`, "Replace the URL with an image that returns HTTP 200.", ERROR_POINTS),
    );
  } else if (image.statusCode === 200) {
    checks.push(check("broken", "Broken images", "pass", "The image returned HTTP 200.", null, 0));
  }

  if (real && !tiny) {
    if (image.altMissing) {
      checks.push(
        check(
          "alt-present",
          "Alt present",
          "error",
          "The alt attribute is missing.",
          "Add alt text that describes the image, or alt=\"\" if it is decorative.",
          ERROR_POINTS,
        ),
      );
    } else {
      checks.push(check("alt-present", "Alt present", "pass", image.alt === "" ? "The alt attribute is present and empty." : "The alt attribute is present.", null, 0));
    }

    if (isContentImage(image)) {
      const generic = isGenericAlt(image);
      if (image.alt === "" || generic) {
        checks.push(
          check(
            "alt-quality",
            "Alt quality",
            "warning",
            image.alt === "" ? "The alt text is empty on a content image." : `The alt text is “${image.alt}”, which does not describe the image.`,
            "Describe what the image shows.",
            WARNING_POINTS,
          ),
        );
      } else if (image.alt) {
        checks.push(check("alt-quality", "Alt quality", "pass", "The alt text describes the image.", null, 0));
      }
    }

    const times = context.keyword && image.alt ? countPhrase(image.alt, context.keyword) : 0;
    const stuffed = times >= 2;
    const duplicates = (context.altCounts.get(altKey(image.alt)) ?? 0) >= 3;
    if (stuffed || duplicates) {
      checks.push(
        check(
          "alt-stuffing",
          "Alt stuffing & duplicates",
          "warning",
          stuffed ? `The focus keyword appears ${times} times in this alt text.` : "The same alt text is used on 3 or more images.",
          stuffed ? "Use the keyword once in the alt text." : "Write a different alt for each image.",
          WARNING_POINTS,
        ),
      );
    } else if (isContentImage(image) || context.keyword) {
      checks.push(check("alt-stuffing", "Alt stuffing & duplicates", "pass", "The alt text is natural and not repeated on 3 or more images.", null, 0));
    }
  }

  if (!image.cssOnly && !isCdnFile(image.url)) {
    if (genericFileName(image.name)) {
      checks.push(
        check(
          "file-name",
          "Descriptive file name",
          "info",
          `The file name is ${image.name}.`,
          "A name such as red-running-shoes.jpg is easier to understand. This does not lower the score.",
          0,
        ),
      );
    } else {
      checks.push(check("file-name", "Descriptive file name", "pass", `The file name is ${image.name}.`, null, 0));
    }
  } else if (!image.cssOnly) {
    checks.push(check("file-name", "Descriptive file name", "pass", "This file name comes from an image CDN, so it was not judged.", null, 0));
  }

  if (!tiny && !image.cssOnly && !image.fetchError && image.statusCode === 200) {
    pushWeight(checks, image);
    pushFormat(checks, image);
  }

  if (real && !tiny && context.hero) {
    if (image.loading === "lazy" || image.lazyOnly) {
      checks.push(
        check(
          "hero-lazy",
          "Hero image not lazy",
          "warning",
          "The top image is set to load later.",
          "Let the top image load immediately. Keep lazy loading for images further down the page.",
          WARNING_POINTS,
        ),
      );
    } else {
      checks.push(check("hero-lazy", "Hero image not lazy", "pass", "The top image loads immediately.", null, 0));
    }
  }

  if (real) {
    if (image.lazyOnly) {
      checks.push(
        check(
          "crawlable-source",
          "Crawlable image source",
          "warning",
          "The image address is only in data-src or data-lazy.",
          "Put the real image URL in the src attribute.",
          WARNING_POINTS,
        ),
      );
    } else {
      checks.push(check("crawlable-source", "Crawlable image source", "pass", "The image address is in src.", null, 0));
    }
  }

  const penalty = checks.some((item) => item.points < 0);
  const scored = !isPixel(image) && (!image.cssOnly || penalty);
  const score = scored ? clamp(100 + checks.reduce((sum, item) => sum + item.points, 0)) : 100;
  const status = worstStatus(checks);
  const lead = checks.find((item) => item.status === "error") ?? checks.find((item) => item.status === "warning") ?? checks.find((item) => item.fix);
  return {
    id: `image-${index + 1}`,
    url: image.url,
    name: image.name,
    alt: image.alt,
    bytes: image.bytes,
    format: image.format,
    width: image.width,
    height: image.height,
    decorative: tiny,
    cssOnly: image.cssOnly,
    ogOnly: image.ogOnly,
    scored,
    status,
    issue: lead && lead.status !== "pass" ? lead.found.replace(/\.$/, "") : "No change needed",
    fix: lead && lead.status !== "pass" ? lead.fix : null,
    score,
    checks,
  };
}

function pushWeight(checks: ImageCheck[], image: MeasuredImage) {
  if (image.bytes === null) return;
  if (image.bytes > MB) {
    checks.push(check("weight", "Image weight", "error", `${formatBytes(image.bytes)} is over 1 MB.`, "Compress this image below 1 MB.", ERROR_POINTS));
    return;
  }
  if (image.bytes > 300 * KB) {
    checks.push(check("weight", "Image weight", "warning", `${formatBytes(image.bytes)} is over 300 KB.`, "Keep this image under 300 KB. A hero can be up to 300 KB.", WARNING_POINTS));
    return;
  }
  checks.push(check("weight", "Image weight", "pass", `${formatBytes(image.bytes)} is within the limit.`, null, 0));
}

function pushFormat(checks: ImageCheck[], image: MeasuredImage) {
  const modern = image.format === "webp" || image.format === "avif" || image.modernSource;
  const heavyJpeg = (image.format === "jpeg" || image.format === "png") && image.bytes !== null && image.bytes > 100 * KB && !modern;
  if (heavyJpeg) {
    checks.push(
      check(
        "modern-format",
        "Modern format",
        "warning",
        `This ${image.format.toUpperCase()} is over 100 KB and has no WebP or AVIF version.`,
        "Serve a WebP or AVIF version.",
        WARNING_POINTS,
      ),
    );
    return;
  }
  if (modern || image.format === "jpeg" || image.format === "png" || image.format === "gif" || image.format === "svg") {
    checks.push(
      check("modern-format", "Modern format", "pass", modern ? "A WebP or AVIF version is available, or the file already uses one." : "This file is small enough that a modern copy is optional.", null, 0),
    );
  }
}

function isRealImage(image: MeasuredImage) {
  return !image.cssOnly && !image.ogOnly;
}

function isContentImage(image: MeasuredImage) {
  return isRealImage(image) && image.inContent && !skipAltAndSize(image);
}

function countsTowardWeight(image: MeasuredImage) {
  return !isPixel(image) && !skipAltAndSize(image);
}

function skipAltAndSize(image: MeasuredImage) {
  if (isPixel(image)) return true;
  const width = image.widthAttr ?? image.width;
  const height = image.heightAttr ?? image.height;
  if (width !== null && height !== null && width < 100 && height < 100) return true;
  if (image.decorativeHint && (image.widthAttr === null || image.widthAttr < 100) && (image.heightAttr === null || image.heightAttr < 100)) return true;
  return false;
}

function isPixel(image: MeasuredImage) {
  return (image.width === 1 && image.height === 1) || (image.widthAttr === 1 && image.heightAttr === 1);
}

function isLazy(image: MeasuredImage) {
  return image.loading === "lazy" || image.lazyOnly || image.jsLazy;
}

function isGenericAlt(image: MeasuredImage) {
  const alt = (image.alt ?? "").trim().toLowerCase();
  if (!alt) return false;
  if (GENERIC_ALT.has(alt)) return true;
  const stem = image.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().toLowerCase();
  return alt === stem;
}

function altKey(alt: string | null) {
  if (!alt) return "";
  return alt.trim().replace(/\s+/g, " ").toLowerCase();
}

function genericFileName(name: string) {
  const decoded = safeDecode(name);
  const stem = decoded.replace(/\.[^.]+$/, "");
  return /^(img|image|photo|dsc|dscn|pict|screenshot|untitled|pic)[-_]?\d*$/i.test(stem) || /^[a-f0-9]{12,}$/i.test(stem);
}

function isCdnFile(url: string) {
  try {
    const parsed = new URL(url);
    return /(?:^|\.)(cloudinary\.com|imgix\.net|imagekit\.io|cloudflare\.com|fbcdn\.net|twimg\.com|googleusercontent\.com|gstatic\.com|shopify\.com|wp\.com|ctfassets\.net|scene7\.com)$/i.test(parsed.hostname) || parsed.pathname.includes("/_next/image");
  } catch {
    return false;
  }
}

function countPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  return [...text.matchAll(pattern)].length;
}

function check(id: string, parameter: string, status: CheckStatus, found: string, fix: string | null, points: number): ImageCheck {
  return { id, parameter, status, found, fix, points };
}

function worstStatus(checks: ImageCheck[]): CheckStatus {
  if (checks.some((item) => item.status === "error")) return "error";
  if (checks.some((item) => item.status === "warning")) return "warning";
  if (checks.some((item) => item.status === "pass")) return "pass";
  return "info";
}

export function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

export function formatBytes(bytes: number) {
  if (bytes >= MB) return `${trimNumber(bytes / MB)} MB`;
  if (bytes >= KB) return `${trimNumber(bytes / KB)} KB`;
  return `${bytes} B`;
}

function trimNumber(value: number) {
  return value >= 10 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();
}

function clamp(score: number) {
  return Math.min(100, Math.max(0, score));
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
