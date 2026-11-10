import type { FailedAsset, JavascriptCheck, JavascriptEvaluation, JsSnapshot } from "./types";

const ERROR_POINTS = -20;
const WARNING_POINTS = -8;

export type JavascriptEvidence = {
  raw: JsSnapshot;
  rendered: JsSnapshot | null;
  renderMs: number;
  consoleErrors: string[];
  failedAssets: FailedAsset[];
  robotsBlocked: string[];
  scriptBytes: number;
  renderError: string;
  sitemapFound: boolean;
  sitemapListed: boolean | null;
  sameTitleOnOtherRoute: boolean | null;
};

export function evaluateJavascript(evidence: JavascriptEvidence): JavascriptEvaluation {
  const rendered = evidence.rendered;
  const csr = isClientOnly(evidence.raw, rendered);
  const checks: JavascriptCheck[] = [
    renderingType(evidence.raw, rendered, csr, evidence.renderError),
    criticalContent(evidence.raw, rendered, evidence.renderError),
    progressive(evidence.raw, rendered, evidence.renderError),
    internalLinks(evidence.raw, rendered),
    historyApi(evidence.raw, rendered),
    metaTags(evidence.raw, rendered, evidence.sameTitleOnOtherRoute),
    structuredData(evidence.raw, rendered),
    lazyLoading(evidence.raw, rendered),
    jsErrors(evidence.consoleErrors, evidence.raw, rendered, evidence.renderError),
    blockedFiles(evidence.robotsBlocked, evidence.failedAssets),
    jsWeight(evidence.scriptBytes, evidence.renderMs, evidence.renderError),
    sitemap(evidence.sitemapFound, evidence.sitemapListed, evidence.raw.finalUrl),
    prerender(csr, evidence.renderError),
    outputRow(evidence.raw, rendered),
  ];
  let score = 100;
  for (const check of checks) score += check.points;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    grade: gradeFor(score),
    rendering: evidence.renderError ? "unknown" : csr ? "csr" : "ssr",
    rawWords: evidence.raw.wordCount,
    renderedWords: rendered?.wordCount ?? 0,
    checks,
  };
}

function renderingType(raw: JsSnapshot, rendered: JsSnapshot | null, csr: boolean, renderError: string): JavascriptCheck {
  if (renderError) {
    return row("rendering-type", "Rendering type", "SSR or SSG", "error", "The rendered page could not be compared.", "Retry the check. The raw HTML alone cannot show whether the page is SSR, SSG, or client-side only.", ERROR_POINTS, renderError);
  }
  if (csr) {
    return row(
      "rendering-type",
      "Rendering type",
      "SSR or SSG",
      "error",
      raw.emptyRoot ? "The raw HTML is an empty app root. The content appears only after JavaScript." : "The raw HTML has almost no page text. The content appears only after JavaScript.",
      "Render the H1 and main text on the server. Next.js: a Server Component or getServerSideProps. Nuxt: SSR or nuxi generate. React: prerender the route. Angular: Angular Universal.",
      ERROR_POINTS,
      `Raw words ${raw.wordCount}. Rendered words ${rendered?.wordCount ?? 0}.`,
    );
  }
  return row("rendering-type", "Rendering type", "SSR or SSG", "pass", "The main content is already in the raw HTML.", null, 0, `Raw words ${raw.wordCount}. Rendered words ${rendered?.wordCount ?? 0}.`);
}

function criticalContent(raw: JsSnapshot, rendered: JsSnapshot | null, renderError: string): JavascriptCheck {
  if (!rendered || renderError) {
    return row("critical-content", "Critical content", "Same in raw and rendered", "warning", "The rendered HTML was not available, so H1 and main text could not be compared.", null, WARNING_POINTS, renderError);
  }
  const rawH1 = raw.h1[0] || "";
  const renderedH1 = rendered.h1[0] || "";
  const h1OnlyAfterJs = Boolean(renderedH1) && !rawH1;
  const textOnlyAfterJs = rendered.wordCount >= 40 && raw.wordCount < Math.max(15, rendered.wordCount * 0.35) && !sharesMainText(raw, rendered);
  const priceOnlyAfterJs = rendered.prices.length > 0 && raw.prices.length === 0;
  if (h1OnlyAfterJs || textOnlyAfterJs || priceOnlyAfterJs) {
    const missing = [h1OnlyAfterJs ? "H1" : "", textOnlyAfterJs ? "main text" : "", priceOnlyAfterJs ? "price" : ""].filter(Boolean).join(", ");
    return row(
      "critical-content",
      "Critical content",
      "Same in raw and rendered",
      "error",
      `${missing} only appears after JavaScript.`,
      "Put the H1, the main text, and any price in the first HTML response, not only in a client render.",
      ERROR_POINTS,
      `Raw H1: ${rawH1 || "none"}\nRendered H1: ${renderedH1 || "none"}`,
    );
  }
  return row("critical-content", "Critical content", "Same in raw and rendered", "pass", rawH1 ? `The H1 is in the raw HTML: “${rawH1}”.` : "The main text is already in the raw HTML.", null, 0, "");
}

function progressive(raw: JsSnapshot, rendered: JsSnapshot | null, renderError: string): JavascriptCheck {
  const usable = raw.wordCount >= 20 && raw.realLinks > 0;
  if (usable) {
    return row("progressive", "Progressive enhancement", "Content and links still work", "pass", "With JavaScript off, the raw HTML still has text and real links.", null, 0, `${raw.wordCount} words · ${raw.internalLinks.length} links`);
  }
  const renderedHasPage = (rendered?.wordCount ?? 0) >= 20 || (rendered?.internalLinks.length ?? 0) > 0;
  if (renderError && raw.wordCount < 20) {
    return row("progressive", "Progressive enhancement", "Content and links still work", "error", "The raw HTML is blank or has no working links, and the rendered page could not be opened.", "Add server-rendered text and <a href> links so the page works with JavaScript off.", ERROR_POINTS, renderError);
  }
  if (raw.wordCount < 15 || (renderedHasPage && raw.internalLinks.length === 0 && raw.wordCount < 20)) {
    return row("progressive", "Progressive enhancement", "Content and links still work", "error", "With JavaScript off the page is blank or has no real links.", "Add the main text and <a href> links to the raw HTML. Do not rely on a client-only router.", ERROR_POINTS, `${raw.wordCount} words in the raw HTML.`);
  }
  return row("progressive", "Progressive enhancement", "Content and links still work", "warning", "The raw HTML has some text, but no internal <a href> links.", "Add real links in the HTML so the page can be used with JavaScript off.", WARNING_POINTS, "");
}

function internalLinks(raw: JsSnapshot, rendered: JsSnapshot | null): JavascriptCheck {
  const rawReal = raw.internalLinks.length;
  const renderedReal = rendered?.internalLinks.length ?? rawReal;
  if (rawReal > 0 && raw.weakLinks <= rawReal) {
    return row("internal-links", "Internal links", "Real <a href> links", "pass", `${rawReal} real internal links are in the raw HTML.`, null, 0, rendered ? `Rendered HTML has ${renderedReal} internal links.` : "");
  }
  if (rawReal === 0 && (raw.weakLinks > 0 || renderedReal > rawReal)) {
    return row(
      "internal-links",
      "Internal links",
      "Real <a href> links",
      "error",
      raw.weakLinks > 0 ? "Navigation uses onclick or # links, not real hrefs." : "Internal links appear only after JavaScript.",
      "Use <a href=\"/path\"> for every internal link. Next.js and Nuxt <Link> render a real href. React Router and Angular routerLink should emit an href, not only an onclick.",
      ERROR_POINTS,
      `Raw real links ${rawReal}. Weak links ${raw.weakLinks}. Rendered real links ${renderedReal}.`,
    );
  }
  return row("internal-links", "Internal links", "Real <a href> links", "warning", "Few real internal links were found in the raw HTML.", "Add <a href> links to the important pages in the first HTML response.", WARNING_POINTS, "");
}

function historyApi(raw: JsSnapshot, rendered: JsSnapshot | null): JavascriptCheck {
  const url = rendered?.finalUrl || raw.finalUrl;
  let hash = "";
  try {
    hash = new URL(url).hash;
  } catch {
    hash = "";
  }
  const status = rendered?.statusCode || raw.statusCode;
  const soft404 = status === 200 && /not found|404|page does not exist/i.test(`${raw.title} ${rendered?.title || ""} ${raw.text.slice(0, 400)}`);
  if (hash.startsWith("#/") || hash.startsWith("#!")) {
    return row("history-api", "History API", "Clean URL per view, 200 status", "error", `This view uses a hash URL: ${url}`, "Give each view its own path with the History API, and return HTTP 200 for that path. Do not use #/ routes.", ERROR_POINTS, `HTTP ${status}`);
  }
  if (soft404) {
    return row("history-api", "History API", "Clean URL per view, 200 status", "warning", "The URL returns 200, but the page text looks like a not-found view.", "Return a real 404 for unknown routes, and a 200 only for views that have their own content.", WARNING_POINTS, url);
  }
  if (status >= 400) {
    return row("history-api", "History API", "Clean URL per view, 200 status", "error", `This URL returned HTTP ${status}.`, "Each SPA view needs a server path that returns 200, not a client-only route.", ERROR_POINTS, url);
  }
  return row("history-api", "History API", "Clean URL per view, 200 status", "pass", `This view has a clean URL and HTTP ${status || 200}.`, null, 0, url);
}

function metaTags(raw: JsSnapshot, rendered: JsSnapshot | null, sameTitleOnOtherRoute: boolean | null): JavascriptCheck {
  const missing = [raw.title ? "" : "title", raw.description ? "" : "description", raw.canonical ? "" : "canonical", raw.robots ? "" : "robots"].filter(Boolean);
  const changed = rendered
    ? [
        raw.title && rendered.title && raw.title !== rendered.title ? "title" : "",
        raw.description && rendered.description && raw.description !== rendered.description ? "description" : "",
        raw.canonical && rendered.canonical && raw.canonical !== rendered.canonical ? "canonical" : "",
        raw.robots && rendered.robots && raw.robots !== rendered.robots ? "robots" : "",
      ].filter(Boolean)
    : [];
  if (missing.length === 4) {
    return row("meta-tags", "Meta tags", "Correct in raw HTML", "error", "Title, description, canonical, and robots are missing from the raw HTML.", "Set the title, meta description, canonical, and robots in the server HTML. Next.js metadata, Nuxt useHead, and Angular Meta must run on the server.", ERROR_POINTS, "");
  }
  if (sameTitleOnOtherRoute) {
    return row("meta-tags", "Meta tags", "Correct in raw HTML", "warning", "Another route in the sitemap uses the same title.", "Give each route its own title, description, and canonical in the raw HTML.", WARNING_POINTS, `Shared title: ${raw.title}`);
  }
  if (changed.length > 0) {
    return row("meta-tags", "Meta tags", "Correct in raw HTML", "warning", `JavaScript changes the ${changed.join(", ")} after the raw HTML.`, "Keep the indexable title, description, canonical, and robots in the first response.", WARNING_POINTS, `Raw title: ${raw.title || "none"}`);
  }
  if (missing.length > 0) {
    return row("meta-tags", "Meta tags", "Correct in raw HTML", "warning", `Missing from the raw HTML: ${missing.join(", ")}.`, "Add the missing tags to the server-rendered head.", WARNING_POINTS, `Raw title: ${raw.title || "none"}`);
  }
  return row("meta-tags", "Meta tags", "Correct in raw HTML", "pass", "Title, description, canonical, and robots are in the raw HTML.", null, 0, raw.title);
}

function structuredData(raw: JsSnapshot, rendered: JsSnapshot | null): JavascriptCheck {
  const rawValid = raw.jsonLd.filter((block) => block.valid);
  const rawInvalid = raw.jsonLd.filter((block) => !block.valid);
  const renderedValid = rendered?.jsonLd.filter((block) => block.valid) ?? [];
  if (rawInvalid.length > 0) {
    return row("structured-data", "Structured data", "Valid, in raw HTML", "error", "A JSON-LD block in the raw HTML is not valid JSON.", "Fix the JSON-LD so JSON.parse succeeds, and keep it in the raw HTML.", ERROR_POINTS, rawInvalid[0]?.text || "");
  }
  if (rawValid.length === 0 && renderedValid.length > 0) {
    return row("structured-data", "Structured data", "Valid, in raw HTML", "warning", "JSON-LD is added only after JavaScript runs.", "Print the JSON-LD script in the server HTML. Do not inject schema only from a client component.", WARNING_POINTS, "");
  }
  if (rawValid.length === 0) {
    return row("structured-data", "Structured data", "Valid, in raw HTML", "info", "No JSON-LD was found in the raw or rendered HTML.", null, 0, "A page can pass without schema. Invalid or JS-only schema is what this row flags.");
  }
  return row("structured-data", "Structured data", "Valid, in raw HTML", "pass", `${rawValid.length} valid JSON-LD block${rawValid.length === 1 ? "" : "s"} in the raw HTML.`, null, 0, "");
}

function lazyLoading(raw: JsSnapshot, rendered: JsSnapshot | null): JavascriptCheck {
  const jsLazy = raw.images.filter((image) => !image.src && image.dataSrc);
  const native = raw.images.filter((image) => image.src && image.loading === "lazy");
  const appeared = rendered ? Math.max(0, rendered.images.filter((image) => image.src).length - raw.images.filter((image) => image.src).length) : 0;
  if (jsLazy.length > 0 || appeared >= 3) {
    return row(
      "lazy-loading",
      "Lazy loading",
      "Native loading=\"lazy\", real src",
      "warning",
      jsLazy.length > 0 ? `${jsLazy.length} image${jsLazy.length === 1 ? "" : "s"} have no src until JavaScript runs.` : `${appeared} images get a src only after JavaScript.`,
      "Use <img src=\"...\" loading=\"lazy\">. Keep a real src in the raw HTML. Do not swap data-src in only on scroll.",
      WARNING_POINTS,
      "",
    );
  }
  if (raw.images.length === 0) {
    return row("lazy-loading", "Lazy loading", "Native loading=\"lazy\", real src", "info", "No images were found on this page.", null, 0, "");
  }
  return row("lazy-loading", "Lazy loading", "Native loading=\"lazy\", real src", "pass", native.length > 0 ? `${native.length} image${native.length === 1 ? "" : "s"} use loading=\"lazy\" with a real src.` : "Images in the raw HTML already have a real src.", null, 0, `${raw.images.length} images`);
}

function jsErrors(errors: string[], raw: JsSnapshot, rendered: JsSnapshot | null, renderError: string): JavascriptCheck {
  if (renderError && errors.length === 0) {
    return row("js-errors", "JS errors", "0 errors", "warning", "The render did not finish, so console errors could not be confirmed.", null, WARNING_POINTS, renderError);
  }
  if (errors.length === 0) return row("js-errors", "JS errors", "0 errors", "pass", "No console errors during render.", null, 0, "");
  const stopped = rendered != null && rendered.wordCount + 30 < raw.wordCount;
  if (stopped) {
    return row("js-errors", "JS errors", "0 errors", "error", `${errors.length} console error${errors.length === 1 ? "" : "s"} and the rendered text is smaller than the raw HTML.`, "Fix the console error that stops the page from rendering. The first error is in the details.", ERROR_POINTS, errors.join("\n"));
  }
  return row("js-errors", "JS errors", "0 errors", "warning", `${errors.length} console error${errors.length === 1 ? "" : "s"} during render. The main content still appeared.`, "Fix the console errors. They are listed in the details.", WARNING_POINTS, errors.join("\n"));
}

function blockedFiles(robotsBlocked: string[], failed: FailedAsset[]): JavascriptCheck {
  if (robotsBlocked.length === 0 && failed.length === 0) {
    return row("blocked-files", "Blocked JS/CSS", "All load", "pass", "robots.txt does not block the JS or CSS files that were checked, and none returned an error.", null, 0, "");
  }
  const sample = [...robotsBlocked.slice(0, 4).map((url) => `robots.txt blocks ${url}`), ...failed.slice(0, 4).map((asset) => `${asset.reason}: ${asset.url}`)].join("\n");
  return row(
    "blocked-files",
    "Blocked JS/CSS",
    "All load",
    "error",
    robotsBlocked.length > 0 ? `${robotsBlocked.length} JS or CSS file${robotsBlocked.length === 1 ? "" : "s"} blocked by robots.txt.` : `${failed.length} JS or CSS file${failed.length === 1 ? "" : "s"} failed to load.`,
    "Allow Googlebot to fetch the JS and CSS in robots.txt, and fix files that return 4xx or 5xx.",
    ERROR_POINTS,
    sample,
  );
}

function jsWeight(scriptBytes: number, renderMs: number, renderError: string): JavascriptCheck {
  if (renderError && scriptBytes === 0) {
    return row("js-weight", "JS weight", "Small bundle, fast render", "info", "Render time and script size were not measured.", null, 0, renderError);
  }
  const kb = Math.round(scriptBytes / 1024);
  const heavy = scriptBytes > 1_500_000 || renderMs > 8_000;
  const slow = scriptBytes > 800_000 || renderMs > 4_000;
  if (heavy) {
    return row("js-weight", "JS weight", "Small bundle, fast render", "warning", `Scripts reported ${kb} KB and the render took ${Math.round(renderMs / 100) / 10}s.`, "Split the route bundle and server-render the first view so the page does not wait on a large client bundle.", WARNING_POINTS, "Size is the sum of Content-Length on script responses. Compressed size can be lower.");
  }
  if (slow) {
    return row("js-weight", "JS weight", "Small bundle, fast render", "info", `Scripts reported ${kb} KB and the render took ${Math.round(renderMs / 100) / 10}s.`, null, 0, "Above a small bundle, still short of the heavy-bundle warning.");
  }
  return row("js-weight", "JS weight", "Small bundle, fast render", "pass", `Scripts reported ${kb} KB and the render took ${Math.round(renderMs / 100) / 10}s.`, null, 0, "");
}

function sitemap(found: boolean, listed: boolean | null, url: string): JavascriptCheck {
  if (!found) {
    return row("sitemap", "Sitemap", "Every route listed", "warning", "No sitemap.xml was found for this host.", "Publish a sitemap with each public route, including client-side views that should be indexed.", WARNING_POINTS, url);
  }
  if (listed === false) {
    return row("sitemap", "Sitemap", "Every route listed", "warning", "This URL is not listed in the sitemap that was fetched.", "Add this route to sitemap.xml. An SPA view that is missing there is easy for Google to skip.", WARNING_POINTS, url);
  }
  return row("sitemap", "Sitemap", "Every route listed", "pass", "This URL is listed in the sitemap.", null, 0, url);
}

function prerender(csr: boolean, renderError: string): JavascriptCheck {
  if (renderError) {
    return row("prerendering", "Prerendering", "Not needed or set up", "info", "Prerender need could not be judged without the rendered HTML.", null, 0, renderError);
  }
  if (csr) {
    return row("prerendering", "Prerendering", "Not needed or set up", "error", "This page needs SSR or prerendering, and the raw HTML does not include it.", "Prerender the route or turn on SSR. Next.js: output the route on the server. Nuxt: ssr: true or generate. React: a prerender build. Angular: Universal.", ERROR_POINTS, "");
  }
  return row("prerendering", "Prerendering", "Not needed or set up", "pass", "The raw HTML already contains the page, so a separate prerender step is not required.", null, 0, "");
}

function outputRow(raw: JsSnapshot, rendered: JsSnapshot | null): JavascriptCheck {
  const renderedWords = rendered ? `${rendered.wordCount} rendered words` : "rendered HTML unavailable";
  return row(
    "output",
    "Output",
    "Copy-ready fix per issue",
    "info",
    `Raw ${raw.wordCount} words · ${renderedWords}. Open a failed row for the fix.`,
    null,
    0,
    `Raw title: ${raw.title || "none"}\nRendered title: ${rendered?.title || "none"}`,
  );
}

function isClientOnly(raw: JsSnapshot, rendered: JsSnapshot | null) {
  if (raw.emptyRoot) return true;
  if (!rendered) return raw.wordCount < 15;
  if (rendered.h1[0] && !raw.h1[0] && raw.wordCount < 40) return true;
  if (raw.wordCount >= 20 && sharesMainText(raw, rendered)) return false;
  return rendered.wordCount >= 40 && raw.wordCount < Math.max(12, rendered.wordCount * 0.25);
}

function sharesMainText(raw: JsSnapshot, rendered: JsSnapshot) {
  const rawTokens = tokens(raw.text);
  const renderedTokens = tokens(rendered.text);
  if (rawTokens.size < 8) return false;
  let hit = 0;
  for (const word of rawTokens) if (renderedTokens.has(word)) hit += 1;
  return hit / rawTokens.size >= 0.6;
}

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2),
  );
}

function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function row(id: string, parameter: string, ideal: string, status: JavascriptCheck["status"], found: string, fix: string | null, points: number, details: string): JavascriptCheck {
  return { id, parameter, ideal, status, found, fix, points, details };
}
