import type { CheckStatus, ImageCheck, ImageRow, ImageSuccess } from "./types";

export type ParameterRow = {
  id: string;
  name: string;
  group: string;
  status: CheckStatus;
  found: string;
  issue: string;
  fix: string | null;
  details: string;
};

const ORDER: { id: string; name: string; group: string; absent: string; absentStatus: CheckStatus }[] = [
  { id: "alt-present", name: "Alt present", group: "Alt text", absent: "Every image has an alt attribute.", absentStatus: "pass" },
  { id: "alt-quality", name: "Alt quality", group: "Alt text", absent: "Content images describe what they show.", absentStatus: "pass" },
  { id: "alt-stuffing", name: "Alt stuffing & duplicates", group: "Alt text", absent: "Alt text is natural and not repeated on 3 or more images.", absentStatus: "pass" },
  { id: "file-name", name: "Descriptive file name", group: "File name", absent: "File names describe the picture, or they come from an image CDN.", absentStatus: "pass" },
  { id: "weight", name: "Image weight", group: "File size", absent: "No image is over 300 KB.", absentStatus: "pass" },
  { id: "modern-format", name: "Modern format", group: "Format", absent: "Large photos are WebP or AVIF, or they are small files.", absentStatus: "pass" },
  { id: "lazy-loading", name: "Lazy loading", group: "Display", absent: "Images below the first one are not all loading at once.", absentStatus: "pass" },
  { id: "hero-lazy", name: "Hero image not lazy", group: "Display", absent: "The top image loads immediately.", absentStatus: "pass" },
  { id: "broken", name: "Broken images", group: "Technical", absent: "No image returned an error status.", absentStatus: "pass" },
  { id: "crawlable-source", name: "Crawlable image source", group: "Technical", absent: "Image addresses are in the src attribute.", absentStatus: "pass" },
];

type Hit = ImageCheck & { image: ImageRow | null };

export function parameterRows(result: ImageSuccess): ParameterRow[] {
  const hits = collect(result);
  return ORDER.map((spec) => {
    const matched = hits.filter((item) => item.id === spec.id);
    if (matched.length === 0) {
      return {
        id: spec.id,
        name: spec.name,
        group: spec.group,
        status: spec.absentStatus,
        found: spec.absent,
        issue: spec.absentStatus === "pass" ? "Meets this check" : spec.absent.replace(/\.$/, ""),
        fix: null,
        details: spec.absent,
      };
    }
    const status = worst(matched.map((item) => item.status));
    const notable = matched.filter((item) => item.status === status);
    const single = notable.length === 1;
    const found = status === "pass" && !single ? `${notable.length} images meet this check.` : single ? notable[0].found : `${notable.length} images. ${notable[0].found}`;
    return {
      id: spec.id,
      name: spec.name,
      group: spec.group,
      status,
      found,
      issue: status === "pass" ? "Meets this check" : notable[0].found.replace(/\.$/, ""),
      fix: status === "pass" ? null : notable.find((item) => item.fix)?.fix ?? null,
      details: notable
        .slice(0, 12)
        .map((item) => (item.image ? `${displayName(item.image)} — ${item.found}` : item.found))
        .concat(notable.length > 12 ? [`And ${notable.length - 12} more.`] : [])
        .join("\n"),
    };
  });
}

export function displayName(image: ImageRow) {
  try {
    const parsed = new URL(image.url);
    const nested = parsed.searchParams.get("url");
    const path = nested ? safePath(nested) : parsed.pathname;
    const name = path.split("/").filter(Boolean).pop();
    if (name && name !== "image") return decodeURIComponent(name);
  } catch {
    /* keep the extracted name */
  }
  return image.name || "image";
}

function collect(result: ImageSuccess): Hit[] {
  const page = result.checks.map((item) => ({ ...item, image: null }));
  const images = result.images.flatMap((image) => image.checks.map((item) => ({ ...item, image })));
  return [...page, ...images];
}

function worst(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  if (statuses.includes("info")) return "info";
  return "pass";
}

function safePath(value: string) {
  try {
    return value.startsWith("http") ? new URL(value).pathname : value;
  } catch {
    return value;
  }
}
