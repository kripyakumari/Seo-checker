import assert from "node:assert/strict";
import { readPixelSize, sniffFormat } from "./dimensions";
import { extractImages } from "./extract";
import { evaluateImages } from "./checks";
import { parameterRows } from "./parameters";
import type { ImageSuccess } from "./types";
import type { MeasuredImage } from "./probe";

function image(overrides: Partial<MeasuredImage> = {}): MeasuredImage {
  return {
    url: "https://example.com/red-running-shoes.jpg",
    name: "red-running-shoes.jpg",
    alt: "Red running shoes on a wooden floor",
    altMissing: false,
    widthAttr: 800,
    heightAttr: 600,
    loading: null,
    responsive: true,
    modernSource: true,
    titleAttr: null,
    hasCaption: false,
    cssOnly: false,
    ogOnly: false,
    decorativeHint: false,
    inContent: true,
    aspectRatio: false,
    lazyOnly: false,
    jsLazy: false,
    statusCode: 200,
    bytes: 80 * 1024,
    width: 800,
    height: 600,
    format: "jpeg",
    fetchError: null,
    ...overrides,
  };
}

function run(images: MeasuredImage[], keyword = "", pageHttps = true) {
  return evaluateImages({ images, keyword, robotsBlocked: new Set(), pageHttps });
}

function byId(row: ReturnType<typeof run>["images"][number], id: string) {
  return row.checks.find((item) => item.id === id);
}

function rows(result: ReturnType<typeof run>) {
  return parameterRows(result as unknown as ImageSuccess);
}

const good = run([image()]);
assert.equal(good.score, 100);
assert.equal(good.grade, "Excellent");
assert.equal(rows(good).length, 10);
assert.deepEqual(
  rows(good).map((item) => item.name),
  [
    "Alt present",
    "Alt quality",
    "Alt stuffing & duplicates",
    "Descriptive file name",
    "Image weight",
    "Modern format",
    "Lazy loading",
    "Hero image not lazy",
    "Broken images",
    "Crawlable image source",
  ],
);

const missing = run([image({ alt: null, altMissing: true })]);
assert.equal(byId(missing.images[0], "alt-present")?.status, "error");
assert.equal(byId(missing.images[0], "alt-present")?.points, -20);
assert.equal(missing.images[0].score, 80);

const empty = run([image({ alt: "" })]);
assert.equal(byId(empty.images[0], "alt-present")?.status, "pass");
assert.equal(byId(empty.images[0], "alt-quality")?.status, "warning");
assert.equal(empty.images[0].score, 92);

const icon = run([
  image({
    name: "arrow.svg",
    url: "https://example.com/arrow.svg",
    alt: "",
    format: "svg",
    widthAttr: 24,
    heightAttr: 24,
    width: 24,
    height: 24,
    bytes: 800,
    decorativeHint: true,
    responsive: false,
  }),
]);
assert.equal(byId(icon.images[0], "alt-quality"), undefined);
assert.equal(byId(icon.images[0], "weight"), undefined);
assert.equal(icon.images[0].score, 100);

const genericAlt = run([image({ alt: "photo" })]);
assert.equal(byId(genericAlt.images[0], "alt-quality")?.status, "warning");

const fileAlt = run([image({ alt: "red running shoes" })]);
assert.equal(byId(fileAlt.images[0], "alt-quality")?.status, "warning");

const stuffed = run([image({ alt: "shoes shoes on the floor" })], "shoes");
assert.equal(byId(stuffed.images[0], "alt-stuffing")?.status, "warning");
assert.equal(byId(stuffed.images[0], "alt-stuffing")?.points, -8);

const once = run([image({ alt: "Red shoes on a wooden floor" })], "shoes");
assert.equal(byId(once.images[0], "alt-stuffing")?.status, "pass");

const twoSame = run([
  image({ url: "https://example.com/one.jpg", name: "one.jpg" }),
  image({ url: "https://example.com/two.jpg", name: "two.jpg" }),
]);
assert.equal(byId(twoSame.images[0], "alt-stuffing")?.status, "pass");

const threeSame = run([
  image({ url: "https://example.com/one.jpg", name: "one.jpg" }),
  image({ url: "https://example.com/two.jpg", name: "two.jpg" }),
  image({ url: "https://example.com/three.jpg", name: "three.jpg" }),
]);
assert.equal(byId(threeSame.images[0], "alt-stuffing")?.status, "warning");
assert.equal(rows(threeSame).find((item) => item.id === "alt-stuffing")?.status, "warning");

const camera = run([image({ name: "DSC_4521.png", url: "https://example.com/DSC_4521.png", format: "png", width: 500, height: 400 })]);
assert.equal(byId(camera.images[0], "file-name")?.status, "info");
assert.equal(byId(camera.images[0], "file-name")?.points, 0);
assert.equal(camera.score, 100);

const cdn = run([image({ name: "a1b2c3d4e5f6a7b8.jpg", url: "https://res.cloudinary.com/demo/image/upload/a1b2c3d4e5f6a7b8.jpg" })]);
assert.equal(byId(cdn.images[0], "file-name")?.status, "pass");

const heroHeavy = run([image({ bytes: 250 * 1024 })]);
assert.equal(byId(heroHeavy.images[0], "weight")?.status, "pass");

const nonHero = run([
  image(),
  image({ url: "https://example.com/side.jpg", name: "side-view.jpg", alt: "Side view of the shoes", bytes: 200 * 1024 }),
]);
assert.equal(byId(nonHero.images[1], "weight")?.status, "pass");

const exact300 = run([image({ bytes: 300 * 1024 })]);
assert.equal(byId(exact300.images[0], "weight")?.status, "pass");

const over300 = run([image({ bytes: 400 * 1024 })]);
assert.equal(byId(over300.images[0], "weight")?.status, "warning");

const overMb = run([image({ bytes: Math.floor(1.2 * 1024 * 1024) })]);
assert.equal(byId(overMb.images[0], "weight")?.status, "error");

const broken = run([image({ statusCode: 404, bytes: null })]);
assert.equal(byId(broken.images[0], "broken")?.status, "error");
assert.equal(byId(broken.images[0], "broken")?.points, -20);

const unread = run([image({ statusCode: null, fetchError: "The image could not be read.", bytes: null })]);
assert.equal(byId(unread.images[0], "broken")?.status, "info");
assert.equal(byId(unread.images[0], "broken")?.points, 0);

const heroLazy = run([image({ loading: "lazy" })]);
assert.equal(byId(heroLazy.images[0], "hero-lazy")?.status, "warning");

const belowLazy = run([
  image(),
  image({ url: "https://example.com/side.jpg", name: "side-view.jpg", alt: "Side view of the shoes", loading: null, jsLazy: false, lazyOnly: false }),
]);
assert.equal(belowLazy.checks.find((item) => item.id === "lazy-loading")?.status, "info");
assert.equal(belowLazy.checks.find((item) => item.id === "lazy-loading")?.points, 0);

const belowOk = run([
  image(),
  image({ url: "https://example.com/side.jpg", name: "side-view.jpg", alt: "Side view of the shoes", loading: "lazy" }),
]);
assert.equal(belowOk.checks.find((item) => item.id === "lazy-loading")?.status, "pass");

const largeJpeg = run([
  image({
    bytes: 180 * 1024,
    width: 1400,
    height: 900,
    format: "jpeg",
    modernSource: false,
    responsive: false,
  }),
]);
assert.equal(byId(largeJpeg.images[0], "modern-format")?.status, "warning");

const small = run([image({ bytes: 20 * 1024, width: 400, height: 300, responsive: false, modernSource: false })]);
assert.equal(byId(small.images[0], "modern-format")?.status, "pass");

const hidden = run([image({ lazyOnly: true, loading: null })]);
assert.equal(byId(hidden.images[0], "crawlable-source")?.status, "warning");
assert.equal(byId(hidden.images[0], "hero-lazy")?.status, "warning");

const none = run([]);
assert.equal(none.score, 100);
assert.equal(none.grade, "No images");

const cssOnly = run([
  image({
    cssOnly: true,
    bytes: 2 * 1024 * 1024,
    alt: null,
    altMissing: false,
    name: "bg.jpg",
    url: "https://example.com/bg.jpg",
    decorativeHint: false,
    inContent: false,
  }),
]);
assert.equal(cssOnly.images[0].scored, false);
assert.equal(cssOnly.score, 100);

const png = new Uint8Array(24);
png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
png[16] = 0;
png[17] = 0;
png[18] = 0x01;
png[19] = 0x2c;
png[20] = 0;
png[21] = 0;
png[22] = 0;
png[23] = 0xc8;
assert.equal(sniffFormat(png, null, "x"), "png");
assert.deepEqual(readPixelSize(png, "png"), { width: 300, height: 200 });

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8]);
assert.equal(sniffFormat(jpeg, null, "x"), "jpeg");
assert.deepEqual(readPixelSize(jpeg, "jpeg"), { width: 200, height: 300 });

const html = `<!doctype html><html><head>
<meta property="og:image" content="https://example.com/share.jpg">
<style>.hero{background:url('/bg.png')}</style>
</head><body>
<img src="/photo.jpg">
<img class="icon" alt="" width="20" height="20" src="/icon.svg">
<img alt="A red shoe" src="/shoe.jpg" srcset="/shoe.jpg 800w, /shoe-small.jpg 400w">
<img alt="Later shoe" data-src="/later.jpg">
<img alt="Secure shoe" src="http://cdn.example.com/plain.jpg" width="400" height="300">
<img alt="Ratio shoe" src="/ratio.jpg" style="aspect-ratio: 4 / 3">
</body></html>`;
const extracted = extractImages(html, "https://example.com/page");
assert.equal(extracted.images.some((item) => item.altMissing), true);
assert.equal(extracted.images.some((item) => item.ogOnly), true);
assert.equal(extracted.images.some((item) => item.cssOnly), true);
const later = extracted.images.find((item) => item.url.endsWith("/later.jpg"));
assert.equal(later?.lazyOnly, true);
assert.equal(later?.alt, "Later shoe");
const secure = extracted.images.find((item) => item.url.startsWith("http://"));
assert.equal(secure?.lazyOnly, false);
const ratioImage = extracted.images.find((item) => item.url.endsWith("/ratio.jpg"));
assert.equal(ratioImage?.aspectRatio, true);
assert.equal(extracted.images.find((item) => item.url.endsWith("/icon.svg"))?.decorativeHint, true);

console.log("image selfcheck passed", good.score, good.grade);
