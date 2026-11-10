"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FaBolt, FaFileAlt, FaGlobe, FaShieldAlt } from "react-icons/fa";
import type { HeadingFailure, HeadingSuccess } from "@/lib/headings/types";
import { parameterRows } from "@/lib/images/parameters";
import type { ImageFailure, ImageSuccess } from "@/lib/images/types";
import type { CanonicalFailure, CanonicalSuccess } from "@/lib/canonical/types";
import type { KeywordFailure, KeywordSuccess } from "@/lib/keyword/types";
import type { LinkFailure, LinkMode, LinkSuccess } from "@/lib/links/types";
import type { DescriptionFailure, DescriptionSuccess } from "@/lib/meta-description/types";
import type { AnalyzeFailure, AnalyzeSuccess } from "@/lib/meta-title/types";
import type { ReadabilityFailure, ReadabilityLanguage, ReadabilitySuccess } from "@/lib/readability/types";
import type { JavascriptFailure, JavascriptSuccess } from "@/lib/javascript/types";
import type { HreflangFailure, HreflangSuccess } from "@/lib/hreflang/types";
import type { UrlFailure, UrlSuccess } from "@/lib/url-structure/types";
import { AuditBoard } from "./audit-board";
import { SiteFooter } from "./site-footer";
import { SiteSections } from "./site-sections";

const HISTORY_KEY = "biziol.titleHistory.v1";
const HOME_SHELL = "mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16 xl:px-20";

const SCAN_STAGES = [
  { id: "title", label: "Title" },
  { id: "description", label: "Description" },
  { id: "canonical", label: "Canonical" },
  { id: "keyword", label: "Keyword" },
  { id: "images", label: "Images" },
  { id: "headings", label: "Headings" },
  { id: "links", label: "Links" },
  { id: "readability", label: "Readability" },
  { id: "url", label: "URL" },
  { id: "javascript", label: "JavaScript" },
  { id: "hreflang", label: "Hreflang" },
] as const;

type HistoryItem = {
  inputUrl: string;
  finalUrl: string;
  title: string;
  score: number | null;
  grade: string;
  imageScore: number | null;
  imageGrade: string;
  headingScore: number | null;
  headingGrade: string;
  linkScore: number | null;
  linkGrade: string;
  linkMode: LinkMode;
  readabilityScore: number | null;
  readabilityGrade: string;
  language: ReadabilityLanguage;
  urlScore: number | null;
  urlGrade: string;
  javascriptScore: number | null;
  javascriptGrade: string;
  hreflangScore: number | null;
  hreflangGrade: string;
  keywordScore: number | null;
  keywordGrade: string;
  descriptionScore: number | null;
  descriptionGrade: string;
  canonicalScore: number | null;
  canonicalGrade: string;
  keyword: string;
  secondary: string;
  brand: string;
  checkedAt: string;
};

type Section = "audit" | "reports";

export function AuditApp() {
  const [section, setSection] = useState<Section>("audit");
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [finished, setFinished] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyzeSuccess | null>(null);
  const [failure, setFailure] = useState<AnalyzeFailure | null>(null);
  const [keywordResult, setKeywordResult] = useState<KeywordSuccess | null>(null);
  const [keywordFailure, setKeywordFailure] = useState<KeywordFailure | null>(null);
  const [descriptionResult, setDescriptionResult] = useState<DescriptionSuccess | null>(null);
  const [descriptionFailure, setDescriptionFailure] = useState<DescriptionFailure | null>(null);
  const [canonicalResult, setCanonicalResult] = useState<CanonicalSuccess | null>(null);
  const [canonicalFailure, setCanonicalFailure] = useState<CanonicalFailure | null>(null);
  const [imageResult, setImageResult] = useState<ImageSuccess | null>(null);
  const [imageFailure, setImageFailure] = useState<ImageFailure | null>(null);
  const [headingResult, setHeadingResult] = useState<HeadingSuccess | null>(null);
  const [headingFailure, setHeadingFailure] = useState<HeadingFailure | null>(null);
  const [linkResult, setLinkResult] = useState<LinkSuccess | null>(null);
  const [linkFailure, setLinkFailure] = useState<LinkFailure | null>(null);
  const [readabilityResult, setReadabilityResult] = useState<ReadabilitySuccess | null>(null);
  const [readabilityFailure, setReadabilityFailure] = useState<ReadabilityFailure | null>(null);
  const [urlResult, setUrlResult] = useState<UrlSuccess | null>(null);
  const [urlFailure, setUrlFailure] = useState<UrlFailure | null>(null);
  const [javascriptResult, setJavascriptResult] = useState<JavascriptSuccess | null>(null);
  const [javascriptFailure, setJavascriptFailure] = useState<JavascriptFailure | null>(null);
  const [hreflangResult, setHreflangResult] = useState<HreflangSuccess | null>(null);
  const [hreflangFailure, setHreflangFailure] = useState<HreflangFailure | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [menuOpen, setMenuOpen] = useState<"product" | "resources" | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored) as HistoryItem[]);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-nav-menu]")) return;
      setMenuOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(null);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function goAudit() {
    setSection("audit");
    setMenuOpen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goReports() {
    setSection("reports");
    setMenuOpen(null);
  }

  function goAnchor(id: string) {
    setSection("audit");
    setMenuOpen(null);
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function goHeroCheck() {
    setSection("audit");
    setMenuOpen(null);
    window.setTimeout(() => {
      document.getElementById("hero-check")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("hero-url")?.focus();
    }, 40);
  }

  async function check(next?: { url: string }) {
    const field = document.getElementById("hero-url");
    const typed = field instanceof HTMLInputElement ? field.value : "";
    const pageUrl = next?.url ?? (typed.trim() ? typed : url);
    if (pageUrl !== url) setUrl(pageUrl);
    if (!pageUrl.trim()) {
      setResult(null);
      setKeywordResult(null);
      setKeywordFailure(null);
      setDescriptionResult(null);
      setDescriptionFailure(null);
      setCanonicalResult(null);
      setCanonicalFailure(null);
      setImageResult(null);
      setImageFailure(null);
      setHeadingResult(null);
      setHeadingFailure(null);
      setLinkResult(null);
      setLinkFailure(null);
      setReadabilityResult(null);
      setReadabilityFailure(null);
      setUrlResult(null);
      setUrlFailure(null);
      setJavascriptResult(null);
      setJavascriptFailure(null);
      setHreflangResult(null);
      setHreflangFailure(null);
      setFailure({
        ok: false,
        error: "Enter a website URL.",
        hint: "Use a domain such as example.com.",
      });
      setPhase("error");
      setSection("audit");
      return;
    }

    setPhase("loading");
    setFinished([]);
    const startedAt = Date.now();
    setFailure(null);
    setResult(null);
    setKeywordResult(null);
    setKeywordFailure(null);
    setDescriptionResult(null);
    setDescriptionFailure(null);
    setCanonicalResult(null);
    setCanonicalFailure(null);
    setImageResult(null);
    setImageFailure(null);
    setHeadingResult(null);
    setHeadingFailure(null);
    setLinkResult(null);
    setLinkFailure(null);
    setReadabilityResult(null);
    setReadabilityFailure(null);
    setUrlResult(null);
    setUrlFailure(null);
    setJavascriptResult(null);
    setJavascriptFailure(null);
    setHreflangResult(null);
    setHreflangFailure(null);
    setSection("audit");
    const payload = {
      url: pageUrl,
      brand: "",
      linkMode: "page" as const,
      language: "en" as const,
    };
    const mark = (id: string) => setFinished((current) => (current.includes(id) ? current : [...current, id]));
    const tracked = <T,>(id: string, work: Promise<T>) => work.finally(() => mark(id));
    try {
      const [titleData, descriptionData, canonicalData, keywordData, imageData, headingData, linkData, readData, urlData, javascriptData, hreflangData] = await Promise.all([
        tracked("title", postCheck<AnalyzeSuccess | AnalyzeFailure>("/api/meta-title", { url: payload.url })),
        tracked("description", postCheck<DescriptionSuccess | DescriptionFailure>("/api/meta-description", { url: payload.url })),
        tracked("canonical", postCheck<CanonicalSuccess | CanonicalFailure>("/api/canonical", { url: payload.url })),
        tracked("keyword", postCheck<KeywordSuccess | KeywordFailure>("/api/keyword", { url: payload.url })),
        tracked("images", postCheck<ImageSuccess | ImageFailure>("/api/images", { url: payload.url })),
        tracked("headings", postCheck<HeadingSuccess | HeadingFailure>("/api/headings", { url: payload.url })),
        tracked("links", postCheck<LinkSuccess | LinkFailure>("/api/links", { url: payload.url, mode: "page" })),
        tracked("readability", postCheck<ReadabilitySuccess | ReadabilityFailure>("/api/readability", { url: payload.url, text: "", language: "en" })),
        tracked("url", postCheck<UrlSuccess | UrlFailure>("/api/url-structure", { url: payload.url })),
        tracked("javascript", postCheck<JavascriptSuccess | JavascriptFailure>("/api/javascript", { url: payload.url })),
        tracked("hreflang", postCheck<HreflangSuccess | HreflangFailure>("/api/hreflang", { url: payload.url })),
      ]);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1400) await new Promise((resolve) => window.setTimeout(resolve, 1400 - elapsed));
      const titleOk = titleData.ok ? titleData : null;
      const descriptionOk = descriptionData.ok ? descriptionData : null;
      const canonicalOk = canonicalData.ok ? canonicalData : null;
      const keywordOk = keywordData.ok ? keywordData : null;
      const imagesOk = imageData.ok ? imageData : null;
      const headingsOk = headingData.ok ? headingData : null;
      const linksOk = linkData.ok ? linkData : null;
      const readOk = readData.ok ? readData : null;
      const urlOk = urlData.ok ? urlData : null;
      const javascriptOk = javascriptData.ok ? javascriptData : null;
      const hreflangOk = hreflangData.ok ? hreflangData : null;
      setResult(titleOk);
      setDescriptionResult(descriptionOk);
      setCanonicalResult(canonicalOk);
      setKeywordResult(keywordOk);
      setImageResult(imagesOk);
      setHeadingResult(headingsOk);
      setLinkResult(linksOk);
      setReadabilityResult(readOk);
      setUrlResult(urlOk);
      setJavascriptResult(javascriptOk);
      setHreflangResult(hreflangOk);
      setFailure(titleData.ok ? null : titleData);
      setDescriptionFailure(descriptionData.ok ? null : descriptionData);
      setCanonicalFailure(canonicalData.ok ? null : canonicalData);
      setKeywordFailure(keywordData.ok ? null : keywordData);
      setImageFailure(imageData.ok ? null : imageData);
      setHeadingFailure(headingData.ok ? null : headingData);
      setLinkFailure(linkData.ok ? null : linkData);
      setReadabilityFailure(readData.ok ? null : readData);
      setUrlFailure(urlData.ok ? null : urlData);
      setJavascriptFailure(javascriptData.ok ? null : javascriptData);
      setHreflangFailure(hreflangData.ok ? null : hreflangData);
      setPhase(titleOk || descriptionOk || canonicalOk || keywordOk || imagesOk || headingsOk || linksOk || readOk || urlOk || javascriptOk || hreflangOk ? "ready" : "error");
      if (titleOk || descriptionOk || canonicalOk || keywordOk || imagesOk || headingsOk || linksOk || readOk || urlOk || javascriptOk || hreflangOk) {
        remember(readOk, titleOk, descriptionOk, canonicalOk, keywordOk, imagesOk, headingsOk, linksOk, urlOk, javascriptOk, hreflangOk, payload);
      }
    } catch {
      const sent = { ok: false as const, error: "The check could not be sent.", hint: "Check your connection and try again." };
      setResult(null);
      setDescriptionResult(null);
      setCanonicalResult(null);
      setKeywordResult(null);
      setImageResult(null);
      setHeadingResult(null);
      setLinkResult(null);
      setReadabilityResult(null);
      setUrlResult(null);
      setJavascriptResult(null);
      setHreflangResult(null);
      setFailure(sent);
      setDescriptionFailure(sent);
      setCanonicalFailure(sent);
      setKeywordFailure(sent);
      setImageFailure(sent);
      setHeadingFailure(sent);
      setLinkFailure(sent);
      setReadabilityFailure(sent);
      setUrlFailure(sent);
      setJavascriptFailure(sent);
      setHreflangFailure(sent);
      setPhase("error");
    }
  }

  function remember(
    readOk: ReadabilitySuccess | null,
    titleOk: AnalyzeSuccess | null,
    descriptionOk: DescriptionSuccess | null,
    canonicalOk: CanonicalSuccess | null,
    keywordOk: KeywordSuccess | null,
    imagesOk: ImageSuccess | null,
    headingsOk: HeadingSuccess | null,
    linksOk: LinkSuccess | null,
    urlOk: UrlSuccess | null,
    javascriptOk: JavascriptSuccess | null,
    hreflangOk: HreflangSuccess | null,
    payload: { url: string; brand: string; linkMode: LinkMode; language: ReadabilityLanguage },
  ) {
    const item: HistoryItem = {
      inputUrl: titleOk?.inputUrl || descriptionOk?.inputUrl || canonicalOk?.inputUrl || keywordOk?.inputUrl || imagesOk?.inputUrl || headingsOk?.inputUrl || linksOk?.inputUrl || readOk?.inputUrl || urlOk?.inputUrl || javascriptOk?.inputUrl || hreflangOk?.inputUrl || payload.url,
      finalUrl: titleOk?.finalUrl || descriptionOk?.finalUrl || canonicalOk?.finalUrl || keywordOk?.finalUrl || imagesOk?.finalUrl || headingsOk?.finalUrl || linksOk?.finalUrl || readOk?.finalUrl || urlOk?.finalUrl || javascriptOk?.finalUrl || hreflangOk?.finalUrl || payload.url,
      title: titleOk?.title || descriptionOk?.title || keywordOk?.title || headingsOk?.title || (readOk?.source === "text" ? "Pasted text" : ""),
      score: titleOk?.score ?? null,
      grade: titleOk?.grade ?? "",
      imageScore: imagesOk?.score ?? null,
      imageGrade: imagesOk?.grade ?? "",
      headingScore: headingsOk?.score ?? null,
      headingGrade: headingsOk?.grade ?? "",
      linkScore: linksOk?.score ?? null,
      linkGrade: linksOk?.grade ?? "",
      linkMode: linksOk?.mode ?? payload.linkMode,
      readabilityScore: readOk?.score ?? null,
      readabilityGrade: readOk?.grade ?? "",
      language: readOk?.language ?? payload.language,
      urlScore: urlOk?.score ?? null,
      urlGrade: urlOk?.grade ?? "",
      javascriptScore: javascriptOk?.score ?? null,
      javascriptGrade: javascriptOk?.grade ?? "",
      hreflangScore: hreflangOk?.score ?? null,
      hreflangGrade: hreflangOk?.grade ?? "",
      keywordScore: keywordOk?.score ?? null,
      keywordGrade: keywordOk?.grade ?? "",
      descriptionScore: descriptionOk?.score ?? null,
      descriptionGrade: descriptionOk?.grade ?? "",
      canonicalScore: canonicalOk?.score ?? null,
      canonicalGrade: canonicalOk?.grade ?? "",
      keyword: keywordOk?.keyword ?? "",
      secondary: keywordOk?.secondary?.join(", ") ?? "",
      brand: payload.brand,
      checkedAt: titleOk?.checkedAt ?? descriptionOk?.checkedAt ?? canonicalOk?.checkedAt ?? keywordOk?.checkedAt ?? imagesOk?.checkedAt ?? headingsOk?.checkedAt ?? linksOk?.checkedAt ?? readOk?.checkedAt ?? urlOk?.checkedAt ?? javascriptOk?.checkedAt ?? hreflangOk?.checkedAt ?? new Date().toISOString(),
    };
    setHistory((current) => {
      const nextHistory = [item, ...current.filter((entry) => entry.finalUrl !== item.finalUrl)].slice(0, 8);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      return nextHistory;
    });
    window.setTimeout(() => {
      document.getElementById("audit-board")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  const ranCheck = Boolean(result || descriptionResult || canonicalResult || keywordResult || imageResult || headingResult || linkResult || readabilityResult || urlResult || javascriptResult || hreflangResult || descriptionFailure || canonicalFailure || keywordFailure || imageFailure || headingFailure || linkFailure || readabilityFailure || urlFailure || javascriptFailure || hreflangFailure);
  const onStage = section === "audit" && (phase === "idle" || phase === "loading" || (phase === "error" && !ranCheck));
  const onBlueStage = onStage && phase === "loading";
  const showIntro = onStage && phase !== "loading";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className={onBlueStage ? "stage-canvas flex min-h-0 flex-1 flex-col" : "flex min-h-0 flex-1 flex-col"}>
      <header className="no-print sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="flex w-full items-center gap-3 px-3 py-3.5 sm:px-5 lg:px-8">
          <button type="button" onClick={goAudit} className="flex shrink-0 items-center gap-2.5 text-left">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white">b</span>
            <span className="leading-tight">
              <span className="block text-lg font-semibold tracking-tight text-ink">biziol</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">SEO audit</span>
            </span>
          </button>

          {phase === "loading" ? (
            <form
              className="mx-auto hidden min-w-0 max-w-xl flex-1 overflow-hidden rounded-full border border-[#c5ced9] bg-white sm:flex"
              onSubmit={(event) => {
                event.preventDefault();
                void check();
              }}
            >
              <input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Website URL" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-ink outline-none" />
              <button type="submit" disabled className="shrink-0 px-4 text-sm font-semibold text-[#1d4ed8]">
                Analyzing...
              </button>
            </form>
          ) : (
            <nav className="mx-auto hidden items-center gap-1 text-ink md:flex" aria-label="Main">
              <div className="relative" data-nav-menu>
                <button
                  type="button"
                  aria-expanded={menuOpen === "product"}
                  onClick={() => setMenuOpen(menuOpen === "product" ? null : "product")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[#f4f7fb] ${section === "audit" ? "text-[#2563eb]" : ""}`}
                >
                  Product
                  <NavChevron open={menuOpen === "product"} />
                </button>
                {menuOpen === "product" ? (
                  <div className="absolute left-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1.5 text-ink shadow-[0_18px_40px_-24px_rgba(27,36,51,0.45)]">
                    <button type="button" onClick={goAudit} className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#f4f7fb]">
                      SEO Audit
                    </button>
                    <button type="button" onClick={goHeroCheck} className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#f4f7fb]">
                      Check a page
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="relative" data-nav-menu>
                <button
                  type="button"
                  aria-expanded={menuOpen === "resources"}
                  onClick={() => setMenuOpen(menuOpen === "resources" ? null : "resources")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[#f4f7fb]"
                >
                  Resources
                  <NavChevron open={menuOpen === "resources"} />
                </button>
                {menuOpen === "resources" ? (
                  <div className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white py-1.5 text-ink shadow-[0_18px_40px_-24px_rgba(27,36,51,0.45)]">
                    <button type="button" onClick={() => goAnchor("how-to-use")} className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#f4f7fb]">
                      How to check a page
                    </button>
                    <button type="button" onClick={() => goAnchor("faq")} className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#f4f7fb]">
                      FAQ
                    </button>
                    <button type="button" onClick={() => goAnchor("reviews")} className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#f4f7fb]">
                      Reviews
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={goReports}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[#f4f7fb] ${section === "reports" ? "text-[#2563eb]" : ""}`}
              >
                Reports
              </button>
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => goAnchor("how-to-use")}
              className="hidden text-sm font-medium text-ink/80 transition hover:text-ink sm:inline-flex"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={goHeroCheck}
              className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] sm:px-5"
            >
              Run free audit
            </button>
          </div>
        </div>
      </header>

      <div className="min-w-0 flex-1">
        {section === "reports" ? (
          <Reports history={history} onOpen={(item) => {
            if (!item.inputUrl.trim()) {
              setSection("audit");
              return;
            }
            void check({ url: item.inputUrl });
          }} onClear={() => {
            window.localStorage.removeItem(HISTORY_KEY);
            setHistory([]);
          }} />
        ) : onStage ? (
          <main
            className={`w-full px-3 sm:px-5 lg:px-6 ${
              phase === "loading"
                ? "py-8"
                : "flex min-h-[calc(100dvh-4.75rem)] flex-col justify-start bg-[radial-gradient(900px_420px_at_50%_0%,rgba(37,99,235,0.08),transparent_60%)] pt-4 pb-8 sm:pt-6 sm:pb-10"
            }`}
          >
            {phase === "loading" ? (
              <div className={HOME_SHELL}>
                <ScanStage url={url} finished={finished} />
              </div>
            ) : (
              <HomeStage
                url={url}
                onUrl={setUrl}
                onSubmit={() => void check()}
                failure={failure}
              />
            )}
          </main>
        ) : (
          <main className="w-full px-3 py-6 sm:px-5 lg:px-6">
            {failure ? (
              <div className="mb-4 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
                <p className="text-sm font-semibold text-clay">{failure.error}</p>
                <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
              </div>
            ) : null}
            {phase === "ready" ? (
              <ReportSummary
                result={result}
                descriptionResult={descriptionResult}
                canonicalResult={canonicalResult}
                keywordResult={keywordResult}
                imageResult={imageResult}
                headingResult={headingResult}
                linkResult={linkResult}
                readabilityResult={readabilityResult}
                urlResult={urlResult}
                javascriptResult={javascriptResult}
                hreflangResult={hreflangResult}
                onAgain={() => void check()}
              />
            ) : null}
            <div className="mt-5">
              <AuditBoard
                result={result}
                descriptionResult={descriptionResult}
                descriptionFailure={descriptionFailure}
                canonicalResult={canonicalResult}
                canonicalFailure={canonicalFailure}
                keywordResult={keywordResult}
                keywordFailure={keywordFailure}
                imageResult={imageResult}
                imageFailure={imageFailure}
                headingResult={headingResult}
                headingFailure={headingFailure}
                linkResult={linkResult}
                linkFailure={linkFailure}
                readabilityResult={readabilityResult}
                readabilityFailure={readabilityFailure}
                urlResult={urlResult}
                urlFailure={urlFailure}
                javascriptResult={javascriptResult}
                javascriptFailure={javascriptFailure}
                hreflangResult={hreflangResult}
                hreflangFailure={hreflangFailure}
                pageError={failure?.error ?? null}
              />
            </div>
          </main>
        )}
      </div>
      </div>
      {showIntro ? (
        <>
          <div className={`${HOME_SHELL} bg-white`}>
            <SiteSections />
          </div>
          <SiteFooter shellClass={HOME_SHELL} />
        </>
      ) : section === "reports" ? (
        <SiteFooter />
      ) : null}
    </div>
  );
}

async function postCheck<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

function NavChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 opacity-60 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeStage({
  url,
  onUrl,
  onSubmit,
  failure,
}: {
  url: string;
  onUrl: (value: string) => void;
  onSubmit: () => void;
  failure: AnalyzeFailure | null;
}) {
  const trusts: { icon: ReactNode; label: string }[] = [
    { icon: <FaBolt className="h-3.5 w-3.5" aria-hidden="true" />, label: "11 live SEO tools" },
    { icon: <FaFileAlt className="h-3.5 w-3.5" aria-hidden="true" />, label: "Free PDF with every failed fix" },
    { icon: <FaShieldAlt className="h-3.5 w-3.5" aria-hidden="true" />, label: "No credit card · public pages only" },
  ];

  return (
    <section id="hero-check" className="w-full scroll-mt-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#dbe7ff] bg-[#eef4ff] px-4 py-2 text-base font-normal tracking-tight text-[#1d4ed8] shadow-[0_10px_30px_-18px_rgba(37,99,235,0.55)] sm:text-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
          </span>
          Free on-page &amp; technical SEO audit · No sign-up to try
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.15] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
          SEO Audit Software Built for Agencies
          <br />
          and SEO Professionals
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[#64748b] sm:text-lg sm:leading-8">
          Paste a URL. biziol reads the public HTML, scores the live checks, and shows the exact fix next to every failed row. JavaScript SEO compares the raw HTML with the rendered page, and Hreflang opens each language version. The other technical tools stay marked as samples.
        </p>
        <form
          className="mt-6 w-full max-w-3xl"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex flex-col gap-2 rounded-full border border-[#c5ced9] bg-white p-2 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)] outline-none sm:flex-row sm:items-center sm:gap-0 sm:pl-5 sm:pr-2">
            <label className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-0">
              <FaGlobe className="hidden h-4 w-4 shrink-0 text-[#94a3b8] sm:block" aria-hidden="true" />
              <span className="sr-only">Website URL</span>
              <input
                id="hero-url"
                value={url}
                onChange={(event) => onUrl(event.target.value)}
                placeholder="Enter any website URL to audit (e.g. yourbrand.com)"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                aria-label="Website URL"
                className="w-full bg-transparent py-3 text-sm font-medium text-ink outline-none placeholder:text-[#94a3b8] sm:py-2.5 sm:text-base"
              />
            </label>
            <button
              type="submit"
              className="shrink-0 rounded-full bg-[#2563eb] px-6 py-3.5 text-sm font-bold text-white transition duration-300 hover:bg-[#1d4ed8] hover:shadow-[0_14px_28px_-12px_rgba(37,99,235,0.85)] sm:px-7"
            >
              Audit Website →
            </button>
          </div>
        </form>
        {failure ? (
          <div className="mt-3 w-full max-w-3xl rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3 text-left" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-muted">{failure.hint}</p>
          </div>
        ) : null}
        <ul className="mt-6 flex flex-col gap-3 text-sm font-semibold text-[#475569] sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-7 sm:gap-y-2">
          {trusts.map((item) => (
            <li key={item.label} className="inline-flex items-center justify-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef4ff] text-[#2563eb]">{item.icon}</span>
              {item.label}
            </li>
          ))}
        </ul>
        <div className="mt-6 w-full max-w-2xl overflow-hidden rounded-full border border-[#93c5fd]/50 bg-[#2563eb]/15 shadow-[0_16px_40px_-28px_rgba(37,99,235,0.45)] backdrop-blur-md">
          <div className="grid grid-cols-3 divide-x divide-[#93c5fd]/40 text-[#1d4ed8]">
            {[
              { value: "11", label: "Live tools" },
              { value: "150+", label: "SEO checks" },
              { value: "₹0", label: "Cost" },
            ].map((stat) => (
              <div key={stat.label} className="px-3 py-4 text-center sm:px-5 sm:py-5">
                <p className="text-2xl font-bold tracking-tight sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]/80 sm:text-[11px]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScanStage({ url, finished }: { url: string; finished: string[] }) {
  const [creep, setCreep] = useState(6);
  useEffect(() => {
    const timer = window.setInterval(() => setCreep((value) => (value >= 28 ? value : value + 1)), 320);
    return () => window.clearInterval(timer);
  }, []);
  const percent = Math.min(100, Math.max(creep, Math.round((finished.length / SCAN_STAGES.length) * 100)));
  let host = url.trim();
  try {
    host = new URL(url.includes("://") ? url : `https://${url}`).host || host;
  } catch {
    host = url.trim();
  }
  const active = SCAN_STAGES.find((stage) => !finished.includes(stage.id))?.id;
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#dbe4f0] bg-white p-3 shadow-[0_24px_50px_-32px_rgba(37,99,235,0.35)] sm:p-4" aria-live="polite">
      <div className="rounded-[22px] bg-[#f8fbff] p-5 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#2563eb]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
          </span>
          Live check
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Checking this page</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748b]">Reading the public HTML for {host || "this URL"}. A check lights up when that part finishes.</p>
        <div className="mt-4 rounded-2xl border border-[#e6edf5] bg-white p-4 text-ink">
          <p className="truncate text-xs text-muted">{host || url}</p>
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[#e8eef6]" />
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#eef3f8]" />
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e6ebf2]">
          <div className="h-full rounded-full bg-[#2563eb] transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-right text-sm font-semibold tabular-nums text-ink">{percent}%</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${finished.length > 0 ? "bg-[#e8f8ef] text-[#067647]" : "bg-white text-[#64748b] ring-1 ring-[#dbe4f0]"}`}>Fetch</span>
          {SCAN_STAGES.map((stage) => {
            const done = finished.includes(stage.id);
            const current = stage.id === active && finished.length > 0;
            return (
              <span key={stage.id} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${done ? "bg-[#e8f8ef] text-[#067647]" : current ? "animate-pulse bg-[#eef4ff] text-[#1d4ed8] ring-1 ring-[#93c5fd]" : "bg-white text-[#64748b] ring-1 ring-[#e6edf5]"}`}>
                {done ? "✓ " : ""}
                {stage.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function gradeFor(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Uneven";
  if (score >= 30) return "Weak";
  return "Poor";
}

function gradeSurface(score: number | null) {
  if (score == null) return "bg-white/20 text-white";
  if (score >= 75) return "bg-[#e8f8ef] text-[#067647]";
  if (score >= 55) return "bg-[#fff1e6] text-[#b54708]";
  return "bg-[#fdecec] text-[#d92d20]";
}

function ReportSummary({
  result,
  descriptionResult,
  canonicalResult,
  keywordResult,
  imageResult,
  headingResult,
  linkResult,
  readabilityResult,
  urlResult,
  javascriptResult,
  hreflangResult,
  onAgain,
}: {
  result: AnalyzeSuccess | null;
  descriptionResult: DescriptionSuccess | null;
  canonicalResult: CanonicalSuccess | null;
  keywordResult: KeywordSuccess | null;
  imageResult: ImageSuccess | null;
  headingResult: HeadingSuccess | null;
  linkResult: LinkSuccess | null;
  readabilityResult: ReadabilitySuccess | null;
  urlResult: UrlSuccess | null;
  javascriptResult: JavascriptSuccess | null;
  hreflangResult: HreflangSuccess | null;
  onAgain: () => void;
}) {
  const scores = [result?.score, descriptionResult?.score, canonicalResult?.score, keywordResult?.score, imageResult?.score, headingResult?.score, linkResult?.score, readabilityResult?.score, urlResult?.score, javascriptResult?.score, hreflangResult?.score].filter((score): score is number => typeof score === "number");
  const overall = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const groups = [result?.checks, descriptionResult?.checks, canonicalResult?.checks, keywordResult?.checks, imageResult ? parameterRows(imageResult) : undefined, headingResult?.checks, linkResult?.checks, readabilityResult?.checks, urlResult?.checks, javascriptResult?.checks, hreflangResult?.checks];
  const passed = groups.reduce((sum, checks) => sum + (checks?.filter((check) => check.status === "pass").length ?? 0), 0);
  const warnings = groups.reduce((sum, checks) => sum + (checks?.filter((check) => check.status === "warning").length ?? 0), 0);
  const errors = groups.reduce((sum, checks) => sum + (checks?.filter((check) => check.status === "error").length ?? 0), 0);
  const finalUrl = result?.finalUrl || descriptionResult?.finalUrl || canonicalResult?.finalUrl || keywordResult?.finalUrl || imageResult?.finalUrl || headingResult?.finalUrl || linkResult?.finalUrl || readabilityResult?.finalUrl || urlResult?.finalUrl || javascriptResult?.finalUrl || hreflangResult?.finalUrl || "";
  const status = result?.statusCode ?? descriptionResult?.statusCode ?? canonicalResult?.statusCode ?? keywordResult?.statusCode ?? imageResult?.statusCode ?? headingResult?.statusCode ?? linkResult?.statusCode ?? readabilityResult?.statusCode ?? urlResult?.statusCode ?? javascriptResult?.statusCode ?? hreflangResult?.statusCode;
  const ms = result?.responseMs ?? descriptionResult?.responseMs ?? canonicalResult?.responseMs ?? keywordResult?.responseMs ?? imageResult?.responseMs ?? headingResult?.responseMs ?? linkResult?.responseMs ?? readabilityResult?.responseMs ?? urlResult?.responseMs ?? javascriptResult?.responseMs ?? hreflangResult?.responseMs;
  const facts = [
    { label: "Response", value: ms == null ? "—" : `${ms} ms` },
    { label: "Words", value: readabilityResult ? String(readabilityResult.wordCount) : "—" },
    { label: "Images", value: imageResult ? String(imageResult.contentCount) : "—" },
    { label: "Links", value: linkResult ? String(linkResult.linkCount) : "—" },
    { label: "Headings", value: headingResult ? String(headingResult.headingCount) : "—" },
    { label: "HTTP", value: status == null ? "—" : String(status) },
  ];
  return (
    <div>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] p-5 text-white sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/15 text-center">
              <span>
                <span className="block text-2xl font-semibold tabular-nums leading-none">{overall ?? "—"}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-white/70">Score</span>
              </span>
            </div>
            <div className={`grid min-h-16 min-w-28 place-items-center rounded-2xl px-3 text-center text-sm font-semibold ${gradeSurface(overall)}`}>
              {overall == null ? "—" : gradeFor(overall)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Check complete</h1>
            {finalUrl ? (
              <a className="mt-1 block truncate text-sm text-white/80" href={finalUrl} target="_blank" rel="noreferrer">
                {finalUrl}
              </a>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Passed" value={passed} />
              <MiniStat label="Warnings" value={warnings} />
              <MiniStat label="Errors" value={errors} />
              <MiniStat label="Total" value={passed + warnings + errors} />
            </div>
          </div>
        </div>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-2xl border border-line bg-white px-4 py-3">
            <p className="text-xs font-medium text-muted">{fact.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{fact.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white">
          Save PDF
        </button>
        <button type="button" onClick={onAgain} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold">
          Check again
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-white/70">{label}</p>
    </div>
  );
}

function Reports({
  history,
  onOpen,
  onClear,
}: {
  history: HistoryItem[];
  onOpen: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  return (
    <main className="w-full px-3 py-6 sm:px-5 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted">Title, description, canonical, keyword, image, heading, link, readability, and URL checks saved in this browser.</p>
        </div>
        {history.length > 0 ? (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-muted">
            Clear
          </button>
        ) : null}
      </div>
      {history.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
          No checks yet. Run an audit and it will show up here.
        </p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {history.map((item) => (
            <li key={`${item.finalUrl}-${item.checkedAt}`}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title || item.finalUrl}</span>
                  <span className="block truncate text-xs text-muted">{item.finalUrl}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-semibold text-[#2563eb]">{item.score ?? "—"}</span>
                  <span className="block text-[11px] text-muted">
                    Title{item.descriptionScore == null ? "" : ` · Description ${item.descriptionScore}`}
                    {item.canonicalScore == null ? "" : ` · Canonical ${item.canonicalScore}`}
                    {item.keywordScore == null ? "" : ` · Keyword ${item.keywordScore}`}
                    {item.imageScore == null ? "" : ` · Images ${item.imageScore}`}
                    {item.headingScore == null ? "" : ` · Headings ${item.headingScore}`}
                    {item.linkScore == null ? "" : ` · Links ${item.linkScore}`}
                    {item.readabilityScore == null ? "" : ` · Readability ${item.readabilityScore}`}
                    {item.urlScore == null ? "" : ` · URL ${item.urlScore}`}
                    {item.javascriptScore == null ? "" : ` · JavaScript ${item.javascriptScore}`}
                    {item.hreflangScore == null ? "" : ` · Hreflang ${item.hreflangScore}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
