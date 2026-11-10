"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SAMPLE_TOOLS, TECHNICAL_TOOLS, type SampleRow } from "@/lib/onpage-dummy";
import { buildCanonicalCsv, buildCanonicalReport } from "@/lib/canonical/report";
import type { CanonicalFailure, CanonicalSuccess } from "@/lib/canonical/types";
import { buildHeadingCsv, buildHeadingReport, buildOutlineText } from "@/lib/headings/report";
import type { HeadingFailure, HeadingSuccess, OutlineNode } from "@/lib/headings/types";
import { buildImageCsv, buildImageReport, formatImageBytes } from "@/lib/images/report";
import { buildKeywordCsv, buildKeywordReport } from "@/lib/keyword/report";
import type { KeywordFailure, KeywordSuccess } from "@/lib/keyword/types";
import { buildLinkCsv, buildLinkReport } from "@/lib/links/report";
import type { LinkFailure, LinkSuccess } from "@/lib/links/types";
import { buildDescriptionCsv, buildDescriptionReport } from "@/lib/meta-description/report";
import { DESKTOP_LIMIT as DESC_DESKTOP } from "@/lib/meta-description/pixels";
import type { DescriptionFailure, DescriptionSuccess } from "@/lib/meta-description/types";
import { buildReadabilityCsv, buildReadabilityReport } from "@/lib/readability/report";
import type { ReadabilityFailure, ReadabilitySuccess } from "@/lib/readability/types";
import { buildJavascriptCsv, buildJavascriptReport } from "@/lib/javascript/report";
import type { JavascriptFailure, JavascriptSuccess } from "@/lib/javascript/types";
import { buildHreflangCsv, buildHreflangReport } from "@/lib/hreflang/report";
import type { HreflangFailure, HreflangSuccess } from "@/lib/hreflang/types";
import { HreflangGenerator, HreflangMap } from "./hreflang-panel";
import { buildUrlCsv, buildUrlReport } from "@/lib/url-structure/report";
import type { UrlFailure, UrlSuccess } from "@/lib/url-structure/types";
import { parameterRows } from "@/lib/images/parameters";
import type { ImageFailure, ImageSuccess } from "@/lib/images/types";
import { buildReport } from "@/lib/meta-title/report";
import type { AnalyzeSuccess } from "@/lib/meta-title/types";
import { SerpPreview } from "./serp-preview";

const LIVE_ID = "meta-title";
const DESC_ID = "meta-description";
const CANONICAL_ID = "canonical";
const KEYWORD_ID = "focus-keyword";
const IMAGE_ID = "images";
const HEADING_ID = "headers";
const LINK_ID = "links";
const READ_ID = "readability";
const URL_ID = "url-structure";
const JS_ID = "javascript-seo";
const HREFLANG_ID = "hreflang";

type CatalogTool = {
  id: string;
  name: string;
  group: string;
  live: boolean;
};

type ToolArea = "on-page" | "technical";
type ToolKind = "all" | "live" | "sample";
type CheckFilter = "all" | "pass" | "warning" | "error";

const CATALOG: CatalogTool[] = [
  { id: LIVE_ID, name: "Meta Title", group: "On-page", live: true },
  { id: DESC_ID, name: "Meta Description", group: "On-page", live: true },
  { id: CANONICAL_ID, name: "Canonical", group: "On-page", live: true },
  { id: KEYWORD_ID, name: "Focus Keyword", group: "On-page", live: true },
  { id: IMAGE_ID, name: "Image Optimization", group: "On-page", live: true },
  { id: HEADING_ID, name: "Header Tags", group: "On-page", live: true },
  { id: LINK_ID, name: "Internal Links", group: "On-page", live: true },
  { id: READ_ID, name: "Readability", group: "On-page", live: true },
  { id: URL_ID, name: "URL Structure", group: "On-page", live: true },
  ...SAMPLE_TOOLS.filter((tool) => tool.id !== "url" && tool.id !== "meta-description" && tool.id !== "canonical").map((tool) => ({
    id: tool.id,
    name: tool.name,
    group: tool.group ?? "On-page",
    live: false,
  })),
  { id: JS_ID, name: "JavaScript SEO", group: "Technical", live: true },
  { id: HREFLANG_ID, name: "Hreflang", group: "Technical", live: true },
  ...TECHNICAL_TOOLS.map((tool) => ({
    id: tool.id,
    name: tool.name,
    group: "Technical",
    live: false,
  })),
];

export function AuditBoard({
  result,
  descriptionResult,
  descriptionFailure,
  canonicalResult,
  canonicalFailure,
  keywordResult,
  keywordFailure,
  imageResult,
  imageFailure,
  headingResult,
  headingFailure,
  linkResult,
  linkFailure,
  readabilityResult,
  readabilityFailure,
  urlResult,
  urlFailure,
  javascriptResult,
  javascriptFailure,
  hreflangResult,
  hreflangFailure,
  pageError,
}: {
  result: AnalyzeSuccess | null;
  descriptionResult: DescriptionSuccess | null;
  descriptionFailure: DescriptionFailure | null;
  canonicalResult: CanonicalSuccess | null;
  canonicalFailure: CanonicalFailure | null;
  keywordResult: KeywordSuccess | null;
  keywordFailure: KeywordFailure | null;
  imageResult: ImageSuccess | null;
  imageFailure: ImageFailure | null;
  headingResult: HeadingSuccess | null;
  headingFailure: HeadingFailure | null;
  linkResult: LinkSuccess | null;
  linkFailure: LinkFailure | null;
  readabilityResult: ReadabilitySuccess | null;
  readabilityFailure: ReadabilityFailure | null;
  urlResult: UrlSuccess | null;
  urlFailure: UrlFailure | null;
  javascriptResult: JavascriptSuccess | null;
  javascriptFailure: JavascriptFailure | null;
  hreflangResult: HreflangSuccess | null;
  hreflangFailure: HreflangFailure | null;
  pageError: string | null;
}) {
  const [selected, setSelected] = useState(LIVE_ID);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<ToolArea>("on-page");
  const [kind, setKind] = useState<ToolKind>("all");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!result && !descriptionResult && !canonicalResult && !keywordResult && !imageResult && !headingResult && !linkResult && !readabilityResult && !urlResult && !javascriptResult && !hreflangResult) return;
    setSelected((current) =>
      current === IMAGE_ID || current === HEADING_ID || current === LINK_ID || current === READ_ID || current === URL_ID || current === JS_ID || current === HREFLANG_ID || current === LIVE_ID || current === KEYWORD_ID || current === DESC_ID || current === CANONICAL_ID
        ? current
        : LIVE_ID,
    );
  }, [result, descriptionResult, canonicalResult, keywordResult, imageResult, headingResult, linkResult, readabilityResult, urlResult, javascriptResult, hreflangResult]);

  const live = result
    ? {
        errors: result.checks.filter((check) => check.status === "error").length,
        warnings: result.checks.filter((check) => check.status === "warning").length,
        passed: result.checks.filter((check) => check.status === "pass").length,
      }
    : null;
  const sample = [...SAMPLE_TOOLS, ...TECHNICAL_TOOLS].find((tool) => tool.id === selected);
  const needle = query.trim().toLowerCase();
  const inArea = CATALOG.filter((tool) => (area === "technical" ? tool.group === "Technical" : tool.group !== "Technical"));
  const visible = inArea.filter((tool) => {
    if (kind === "live" && !tool.live) return false;
    if (kind === "sample" && tool.live) return false;
    if (!needle) return true;
    return tool.name.toLowerCase().includes(needle) || tool.group.toLowerCase().includes(needle);
  });

  function countsFor(tool: CatalogTool) {
    if (tool.id === LIVE_ID) return live;
    if (tool.id === DESC_ID) return descriptionResult ? tallyDescription(descriptionResult) : null;
    if (tool.id === CANONICAL_ID) return canonicalResult ? tallyCanonical(canonicalResult) : null;
    if (tool.id === KEYWORD_ID) return keywordResult ? tallyKeyword(keywordResult) : null;
    if (tool.id === IMAGE_ID) return imageResult ? tally(imageResult) : null;
    if (tool.id === HEADING_ID) return headingResult ? tallyHeadings(headingResult) : null;
    if (tool.id === LINK_ID) return linkResult ? tallyLinks(linkResult) : null;
    if (tool.id === READ_ID) return readabilityResult ? tallyReadability(readabilityResult) : null;
    if (tool.id === URL_ID) return urlResult ? tallyUrl(urlResult) : null;
    if (tool.id === JS_ID) return javascriptResult ? tallyJavascript(javascriptResult) : null;
    if (tool.id === HREFLANG_ID) return hreflangResult ? tallyHreflang(hreflangResult) : null;
    const preview = [...SAMPLE_TOOLS, ...TECHNICAL_TOOLS].find((item) => item.id === tool.id);
    return preview ? sampleCountsFor(preview.rows) : null;
  }

  function selectTool(id: string) {
    setSelected(id);
    setOpenRow(null);
  }

  function chooseArea(next: ToolArea) {
    setArea(next);
    setKind("all");
    const first = CATALOG.find((tool) => (next === "technical" ? tool.group === "Technical" : tool.group !== "Technical"));
    if (first && !CATALOG.some((tool) => tool.id === selected && (next === "technical" ? tool.group === "Technical" : tool.group !== "Technical"))) {
      selectTool(first.id);
    }
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1400);
  }

  const liveCount = inArea.filter((tool) => tool.live).length;
  const sampleCount = inArea.filter((tool) => !tool.live).length;

  return (
    <div id="audit-board" className="scroll-mt-6 xl:grid xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start xl:gap-4">
      <aside className="rounded-2xl border border-line bg-card p-3 shadow-[0_1px_2px_rgba(27,36,51,0.04)] xl:sticky xl:top-[4.5rem]">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">SEO tools</p>
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-[#f4f7fb] p-1" role="tablist">
          <button type="button" role="tab" aria-selected={area === "on-page"} onClick={() => chooseArea("on-page")} className={`rounded-lg px-2 py-2 text-sm font-semibold ${area === "on-page" ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
            On-Page SEO
          </button>
          <button type="button" role="tab" aria-selected={area === "technical"} onClick={() => chooseArea("technical")} className={`rounded-lg px-2 py-2 text-sm font-semibold ${area === "technical" ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
            Technical SEO
          </button>
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Search tools</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools"
            className="w-full rounded-xl border border-line bg-[#f8fafc] px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:bg-white"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <FilterPill active={kind === "all"} onClick={() => setKind("all")}>{`All ${inArea.length}`}</FilterPill>
          <FilterPill active={kind === "live"} onClick={() => setKind("live")}>{`Live ${liveCount}`}</FilterPill>
          <FilterPill active={kind === "sample"} onClick={() => setKind("sample")}>{`Sample ${sampleCount}`}</FilterPill>
        </div>
        <nav aria-label="Audit tools" className="mt-3 max-h-80 space-y-2 overflow-auto pr-1 xl:max-h-[calc(100vh-13.5rem)]">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm leading-6 text-muted">
              {area === "technical" ? "No technical checks in this list yet." : "No tools match that search."}
            </p>
          ) : (
            visible.map((tool) => (
              <ToolRow key={tool.id} name={tool.name} live={tool.live} selected={selected === tool.id} counts={countsFor(tool)} onClick={() => selectTool(tool.id)} />
            ))
          )}
        </nav>
      </aside>

      <section className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_8px_30px_rgba(27,36,51,0.04)] xl:mt-0">
        {selected === LIVE_ID ? (
          <LiveTitlePanel result={result} openRow={openRow} copied={copied} onToggle={(id) => setOpenRow((current) => (current === id ? null : id))} onCopy={copyText} />
        ) : selected === DESC_ID ? (
          <DescriptionPanel result={descriptionResult} failure={descriptionFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : selected === CANONICAL_ID ? (
          <CanonicalPanel result={canonicalResult} failure={canonicalFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : selected === KEYWORD_ID ? (
          <KeywordPanel result={keywordResult} failure={keywordFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : selected === IMAGE_ID ? (
          <ImagePanel result={imageResult} failure={imageFailure} pageError={pageError} openRow={openRow} copied={copied} onToggle={(id) => setOpenRow((current) => (current === id ? null : id))} onCopy={copyText} />
        ) : selected === HEADING_ID ? (
          <HeadingPanel result={headingResult} failure={headingFailure} pageError={pageError} openRow={openRow} copied={copied} onToggle={(id) => setOpenRow((current) => (current === id ? null : id))} onCopy={copyText} />
        ) : selected === LINK_ID ? (
          <LinkPanel result={linkResult} failure={linkFailure} pageError={pageError} openRow={openRow} copied={copied} onToggle={(id) => setOpenRow((current) => (current === id ? null : id))} onCopy={copyText} />
        ) : selected === READ_ID ? (
          <ReadabilityPanel result={readabilityResult} failure={readabilityFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : selected === URL_ID ? (
          <UrlPanel result={urlResult} failure={urlFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : selected === JS_ID ? (
          <JavascriptPanel result={javascriptResult} failure={javascriptFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : selected === HREFLANG_ID ? (
          <HreflangPanel result={hreflangResult} failure={hreflangFailure} pageError={pageError} copied={copied} onCopy={copyText} />
        ) : sample ? (
          <SamplePanel name={sample.name} blurb={sample.blurb} rows={sample.rows} openRow={openRow} copied={copied} onToggle={(id) => setOpenRow((current) => (current === id ? null : id))} onCopy={copyText} />
        ) : null}
      </section>
    </div>
  );
}

function sampleCountsFor(rows: SampleRow[]) {
  return {
    errors: rows.filter((row) => row.status === "error").length,
    warnings: rows.filter((row) => row.status === "warning").length,
    passed: rows.filter((row) => row.status === "pass").length,
  };
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#eef4ff] text-[#2563eb]" : "bg-[#f4f7fb] text-muted"}`}>
      {children}
    </button>
  );
}

function ToolRow({
  name,
  selected,
  counts,
  live,
  onClick,
}: {
  name: string;
  selected: boolean;
  counts: { errors: number; warnings: number; passed: number } | null;
  live?: boolean;
  onClick: () => void;
}) {
  const total = counts ? counts.errors + counts.warnings + counts.passed : null;
  const badge = !counts ? "bg-[#f4f7fb] text-muted" : counts.errors > 0 ? "bg-[#fdecec] text-clay" : counts.warnings > 0 ? "bg-[#fff1e6] text-amber" : "bg-[#e8f8ef] text-moss";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium ${selected ? "bg-[#2563eb] text-white" : "text-ink hover:bg-[#f4f7fb]"}`}
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${selected ? "bg-white/15" : "bg-[#f4f7fb] text-[#2563eb]"}`}>
        <ToolGlyph name={name} />
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {!live ? <span className={`text-[10px] font-semibold uppercase ${selected ? "text-white/70" : "text-muted"}`}>Sample</span> : null}
      {total != null ? <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${selected ? "bg-white/20 text-white" : badge}`}>{total}</span> : null}
    </button>
  );
}

function CountLine({ counts }: { counts: { errors: number; warnings: number; passed: number } }) {
  return (
    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-medium">
      <span className="text-clay">{counts.errors} Errors</span>
      <span className="text-amber">{counts.warnings} Warnings</span>
      <span className="text-moss">{counts.passed} Passed</span>
    </span>
  );
}

function LiveTitlePanel({
  result,
  copied,
  onCopy,
}: {
  result: AnalyzeSuccess | null;
  openRow: string | null;
  copied: string | null;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
}) {
  const [filter, setFilter] = useState<CheckFilter>("all");
  if (!result) {
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading title="Meta Title Audit" blurb="The title is fetched from the live page. Length, pixel width, the domain name as the brand, and technical checks are scored here." counts={null} />
        <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
          Enter a public URL and press Analyze Website. Each parameter is listed with its result. Open Details to see why it passed or failed.
        </p>
      </div>
    );
  }
  const counts = {
    errors: result.checks.filter((check) => check.status === "error").length,
    warnings: result.checks.filter((check) => check.status === "warning").length,
    passed: result.checks.filter((check) => check.status === "pass").length,
  };
  function showGroup(group: "pass" | "warning" | "error") {
    setFilter((current) => (current === group ? "all" : group));
  }
  return (
    <div>
      <div className="border-b border-line bg-[#f8fafc] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ScoreRing score={result.score} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Page score
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-ink">{result.grade}</span>
                </p>
                <p className="mt-1 text-lg font-semibold leading-snug">{result.title || "No title on this page."}</p>
                <a className="mt-1 block truncate text-sm text-[#2563eb]" href={result.finalUrl} target="_blank" rel="noreferrer">
                  {result.finalUrl}
                </a>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  <ScoreStat value={counts.errors} label="Errors" tone="error" active={filter === "error"} onClick={() => showGroup("error")} />
                  <ScoreStat value={counts.warnings} label="Warnings" tone="warning" active={filter === "warning"} onClick={() => showGroup("warning")} />
                  <ScoreStat value={counts.passed} label="Passed" tone="pass" active={filter === "pass"} onClick={() => showGroup("pass")} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  HTTP {result.statusCode} · {result.responseMs} ms · {result.measurements.characters} characters · {result.measurements.desktopPx}px
                  {result.brand ? ` · Brand “${result.brand}”` : ""}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!result.title} onClick={() => onCopy("title", result.title)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink disabled:opacity-40">
                {copied === "title" ? "Copied" : "Copy title"}
              </button>
              <button type="button" onClick={() => downloadReport(result)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
                Download report
              </button>
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
                Save PDF
              </button>
            </div>
          </div>
          <SerpPreview title={result.title} cut={result.measurements.desktopCut} description={result.metaDescription} finalUrl={result.finalUrl} label="Desktop preview" limit={600} frame="w-full shrink-0 lg:w-[340px]" />
        </div>
      </div>
      <ParameterList checks={result.checks} filter={filter} copied={copied} onCopy={onCopy} />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const tone = score >= 75 ? "text-moss" : score >= 55 ? "text-amber" : "text-clay";
  return (
    <div className={`relative h-36 w-36 shrink-0 ${tone}`}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e7edf5" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={drawn ? offset : circumference} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-ink">
        <span className="text-4xl font-semibold tabular-nums leading-none">{score}</span>
        <span className="mt-1 text-[11px] font-medium text-muted">of 100</span>
      </div>
    </div>
  );
}

function ScoreStat({
  value,
  label,
  tone,
  active,
  onClick,
}: {
  value: number;
  label: string;
  tone: "error" | "warning" | "pass";
  active: boolean;
  onClick: () => void;
}) {
  const surface = tone === "error" ? "bg-[#fff7f7] text-clay" : tone === "warning" ? "bg-[#fffaf3] text-amber" : "bg-[#f7fcf8] text-moss";
  const ring = tone === "error" ? "ring-clay" : tone === "warning" ? "ring-amber" : "ring-moss";
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-3 py-3 text-left transition hover:-translate-y-0.5 ${surface} ${active ? `ring-2 ${ring}` : ""}`}>
      <span className="block text-2xl font-semibold tabular-nums leading-none">{value}</span>
      <span className="mt-1 block text-xs font-semibold">{label}</span>
    </button>
  );
}

type BoardCheck = {
  id: string;
  parameter: string;
  status: "pass" | "warning" | "error" | "info";
  found: string;
  fix: string | null;
  details?: string;
};

const STATUS_RANK: Record<BoardCheck["status"], number> = { error: 0, warning: 1, info: 2, pass: 3 };

function ParameterList({
  checks,
  filter,
  copied,
  onCopy,
}: {
  checks: BoardCheck[];
  filter: CheckFilter;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = checks
    .filter((check) => {
      if (filter === "all") return true;
      if (filter === "pass") return check.status === "pass" || check.status === "info";
      return check.status === filter;
    })
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  return (
    <div className="px-5 py-5 sm:px-6">
      {visible.length === 0 ? (
        <p className="rounded-xl bg-[#f8fafc] px-4 py-5 text-sm text-muted">Nothing in this group.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((check) => (
            <ParameterRow key={check.id} check={check} open={openId === check.id} copied={copied === check.id} onToggle={() => setOpenId((current) => (current === check.id ? null : check.id))} onCopy={() => onCopy(check.id, check.fix ?? check.found)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ParameterRow({
  check,
  open,
  copied,
  onToggle,
  onCopy,
}: {
  check: BoardCheck;
  open: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const bar = check.status === "error" ? "border-l-clay" : check.status === "warning" ? "border-l-amber" : check.status === "info" ? "border-l-[#94a3b8]" : "border-l-moss";
  const badge = check.status === "error" ? "bg-[#fdecec] text-clay" : check.status === "warning" ? "bg-[#fff1e6] text-amber" : check.status === "info" ? "bg-[#f1f4f8] text-muted" : "bg-[#e8f8ef] text-moss";
  const label = check.status === "error" ? "Error" : check.status === "warning" ? "Warning" : check.status === "info" ? "Info" : "Pass";
  const extra = check.details && check.details !== check.found ? check.details : "";
  return (
    <li className={`overflow-hidden rounded-xl border border-line border-l-4 bg-white ${bar}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${badge}`} aria-hidden="true">
          {check.status === "pass" ? "✓" : check.status === "info" ? "i" : "!"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{check.parameter}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{check.found}</p>
          <button type="button" onClick={onToggle} className="mt-1 text-xs font-semibold text-[#2563eb]" aria-expanded={open}>
            {open ? "Hide details" : "Details"}
          </button>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge}`}>{label}</span>
      </div>
      {open ? (
        <div className="border-t border-line bg-[#f8fafc] px-4 py-3 sm:pl-[3.25rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Result</p>
          <p className="mt-1 text-sm leading-6 text-ink">{check.found}</p>
          {extra ? <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted">{extra}</p> : null}
          {check.status === "pass" ? <p className="mt-3 text-xs font-semibold text-moss">This parameter passed.</p> : null}
          {check.status === "info" ? <p className="mt-3 text-xs font-semibold text-muted">Info only — this row does not change the score.</p> : null}
          {check.fix ? (
            <>
              <p className={`mt-3 text-xs font-semibold ${check.status === "error" ? "text-clay" : "text-amber"}`}>{check.status === "error" ? "Correction" : "What to change"}</p>
              <p className="mt-1 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-ink">{check.fix}</p>
              <button type="button" onClick={onCopy} className="mt-2 text-xs font-semibold text-[#2563eb]">
                {copied ? "Copied" : "Copy correction"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function CheckBoard({
  score,
  grade,
  headline,
  url,
  facts,
  actions,
  aside,
  checks,
  copied,
  onCopy,
  emptyRing = "Sample",
}: {
  score: number | null;
  grade?: string;
  headline: string;
  url?: string;
  facts: string;
  actions?: ReactNode;
  aside?: ReactNode;
  checks: BoardCheck[];
  copied: string | null;
  onCopy: (id: string, text: string) => void;
  emptyRing?: string;
}) {
  const [filter, setFilter] = useState<CheckFilter>("all");
  const counts = {
    errors: checks.filter((check) => check.status === "error").length,
    warnings: checks.filter((check) => check.status === "warning").length,
    passed: checks.filter((check) => check.status === "pass").length,
  };
  function showGroup(group: "pass" | "warning" | "error") {
    setFilter((current) => (current === group ? "all" : group));
  }
  return (
    <div>
      <div className="border-b border-line bg-[#f8fafc] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {score == null ? (
                <div className="grid h-36 w-36 shrink-0 place-items-center rounded-full border border-dashed border-amber bg-[#fffaf3] px-4 text-center text-sm font-semibold text-amber">{emptyRing}</div>
              ) : (
                <ScoreRing score={score} />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Page score
                  {grade ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-ink">{grade}</span> : <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber">Not live</span>}
                </p>
                <p className="mt-1 text-lg font-semibold leading-snug">{headline}</p>
                {url ? (
                  <a className="mt-1 block truncate text-sm text-[#2563eb]" href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                ) : null}
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  <ScoreStat value={counts.errors} label="Errors" tone="error" active={filter === "error"} onClick={() => showGroup("error")} />
                  <ScoreStat value={counts.warnings} label="Warnings" tone="warning" active={filter === "warning"} onClick={() => showGroup("warning")} />
                  <ScoreStat value={counts.passed} label="Passed" tone="pass" active={filter === "pass"} onClick={() => showGroup("pass")} />
                </div>
                <p className="mt-3 text-xs text-muted">{facts}</p>
              </div>
            </div>
            {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
          </div>
          {aside}
        </div>
      </div>
      <ParameterList checks={checks} filter={filter} copied={copied} onCopy={onCopy} />
    </div>
  );
}

function SamplePanel({
  name,
  blurb,
  rows,
  copied,
  onCopy,
}: {
  name: string;
  blurb: string;
  rows: SampleRow[];
  openRow: string | null;
  copied: string | null;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
}) {
  const checks: BoardCheck[] = rows.map((row) => ({
    id: `${name}-${row.path}`,
    parameter: row.page,
    status: row.status,
    found: row.status === "pass" ? `${row.value.replace(/\.+$/, "")}. ${row.issue}` : row.issue,
    fix: row.status === "pass" ? null : row.improvement ?? row.suggestion,
  }));
  return (
    <CheckBoard
      score={null}
      headline={name}
      facts="Sample data. This tool is not reading the live page yet."
      checks={checks}
      copied={copied}
      onCopy={onCopy}
      aside={
        <p className="w-full shrink-0 rounded-2xl border border-[#f3ddc4] bg-[#fffaf3] px-4 py-4 text-sm leading-6 text-ink lg:w-[340px]">
          {blurb} The rows below are examples, grouped the same way as a live check.
        </p>
      }
    />
  );
}

function PanelHeading({
  title,
  blurb,
  counts,
}: {
  title: string;
  blurb: string;
  counts: { errors: number; warnings: number; passed: number } | null;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{blurb}</p>
      </div>
      {counts ? <CountLine counts={counts} /> : null}
    </div>
  );
}

function iconBg(tone: string) {
  if (tone.includes("clay")) return "bg-[#fdecec] text-clay";
  if (tone.includes("amber")) return "bg-[#fff1e6] text-amber";
  if (tone.includes("moss")) return "bg-[#e8f8ef] text-moss";
  return "bg-[#f1f4f8] text-muted";
}

function ToolGlyph({ name }: { name: string }) {
  const common = "h-4 w-4";
  if (name.startsWith("Meta Title")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 6h12M6 12h8M6 18h5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Meta Description")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 7h14M5 12h14M5 17h9" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Internal")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" strokeLinecap="round" />
        <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Header")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M7 6v12M17 6v12M7 12h10" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Image")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 14l2.5-2.5L14 15l2-2 2 2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Internal")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.1.1l1.4-1.5a5 5 0 0 0-7-7.1L10 6" strokeLinecap="round" />
        <path d="M14 11a5 5 0 0 0-7.1-.1L5.5 12.4a5 5 0 0 0 7 7.1L14 18" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Readability")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 7h12M6 12h12M6 17h8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("URL")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4c2.5 2.8 2.5 13.2 0 16M12 4c-2.5 2.8-2.5 13.2 0 16" />
      </svg>
    );
  }
  if (name.startsWith("Focus Keyword")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name.startsWith("Canonical")) {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M7 12.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 8H5v11h11v-3M10 5h9v9" strokeLinecap="round" />
    </svg>
  );
}

function tallyLinks(result: LinkSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function LinkPanel({
  result,
  failure,
  pageError,
  openRow,
  copied,
  onToggle,
  onCopy,
}: {
  result: LinkSuccess | null;
  failure: LinkFailure | null;
  pageError: string | null;
  openRow: string | null;
  copied: string | null;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Internal Links"
          blurb="The rows are the internal-link checks that affect crawling and ranking. This page is the default. Whole site adds orphan, depth, and hierarchy rows."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError
              ? "This check stopped for the same reason as the message above."
              : "Enter a public URL and press Analyze Website. This card lists each link parameter and the correction."}
          </p>
        )}
      </div>
    );
  }

  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="Internal Links"
      url={result.finalUrl}
      facts={`HTTP ${result.statusCode} · ${result.responseMs} ms · ${result.linkCount} internal ${result.linkCount === 1 ? "link" : "links"} · ${result.bodyCount} in the body${result.keyword ? ` · Keyword “${result.keyword}”` : ""}${result.mode === "site" ? ` · Whole site, ${result.crawledPages} pages` : " · This page"}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => downloadText("biziol-links.txt", buildLinkReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-links.csv", buildLinkCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">This check</p>
          <p className="mt-2 text-sm font-semibold">{result.mode === "site" ? "Whole site" : "This page"}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {result.linkCount} internal {result.linkCount === 1 ? "link" : "links"}, {result.bodyCount} in the body.
            {result.mode === "site" ? ` ${result.crawledPages} pages crawled.` : ""}
          </p>
        </div>
      }
    />
  );
}

function tallyHeadings(result: HeadingSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function HeadingPanel({
  result,
  failure,
  pageError,
  openRow,
  copied,
  onToggle,
  onCopy,
}: {
  result: HeadingSuccess | null;
  failure: HeadingFailure | null;
  pageError: string | null;
  openRow: string | null;
  copied: string | null;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Header Tags"
          blurb="The rows are the heading checklist. A page with no headings still gets a result. Only a bad URL or a failed load stops the check."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError
              ? "This check stopped for the same reason as the message above."
              : "Enter a public URL and press Analyze Website. This card lists each heading parameter, the outline, and the correction."}
          </p>
        )}
      </div>
    );
  }

  const outline = buildOutlineText(result.outline);
  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline={result.title || "Header Tags"}
      url={result.finalUrl}
      facts={`HTTP ${result.statusCode} · ${result.responseMs} ms · ${result.headingCount} ${result.headingCount === 1 ? "heading" : "headings"} · ${result.h1Count} H1${result.keyword ? ` · Keyword “${result.keyword}”` : ""}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => onCopy("outline", outline || "No headings to outline.")} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            {copied === "outline" ? "Copied" : "Copy outline"}
          </button>
          <button type="button" onClick={() => downloadText("biziol-headings.txt", buildHeadingReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-headings.csv", buildHeadingCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Outline</p>
          {result.outline.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No headings to outline. Add a real H1 that states what the page is about.</p>
          ) : (
            <div className="mt-2 max-h-64 overflow-auto">
              <OutlineList nodes={result.outline} />
            </div>
          )}
        </div>
      }
    />
  );
}

function OutlineList({ nodes }: { nodes: OutlineNode[] }) {
  return (
    <ul className="grid gap-1">
      {nodes.map((node, index) => (
        <li key={`${node.level}-${index}-${node.text}`}>
          <p className="text-sm">
            <span className="mr-2 font-semibold text-muted">H{node.level}</span>
            {node.text}
          </p>
          {node.children.length > 0 ? (
            <div className="mt-1 ml-4 border-l border-line pl-3">
              <OutlineList nodes={node.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function tally(result: ImageSuccess) {
  const rows = parameterRows(result);
  return {
    errors: rows.filter((item) => item.status === "error").length,
    warnings: rows.filter((item) => item.status === "warning").length,
    passed: rows.filter((item) => item.status === "pass").length,
  };
}

function ImagePanel({
  result,
  failure,
  pageError,
  openRow,
  copied,
  onToggle,
  onCopy,
}: {
  result: ImageSuccess | null;
  failure: ImageFailure | null;
  pageError: string | null;
  openRow: string | null;
  copied: string | null;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Image Optimization"
          blurb="Fifteen image checks: alt text, file name, size, format, display, and whether Google can fetch the file. 1×1 pixels and tiny icons are left out of the alt and size checks."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError
              ? "This check stopped for the same reason as the message above."
              : "Enter a public URL and press Analyze Website. This card lists each image parameter, the result, and the correction."}
          </p>
        )}
      </div>
    );
  }

  const rows = parameterRows(result);
  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="Image Optimization"
      url={result.finalUrl}
      facts={`HTTP ${result.statusCode} · ${result.responseMs} ms · ${result.contentCount} content ${result.contentCount === 1 ? "image" : "images"} · ${formatImageBytes(result.totalBytes)}${result.keyword ? ` · Keyword “${result.keyword}”` : ""}`}
      copied={copied}
      onCopy={onCopy}
      checks={rows.map((item) => ({
        id: item.id,
        parameter: item.name,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => downloadText("biziol-images.txt", buildImageReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-images.csv", buildImageCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Images on this page</p>
          <p className="mt-2 text-sm font-semibold">
            {result.contentCount} content {result.contentCount === 1 ? "image" : "images"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {formatImageBytes(result.totalBytes)} total.
            {result.listedCount > result.contentCount ? ` ${result.listedCount - result.contentCount} listed images are not in the score.` : ""}
          </p>
        </div>
      }
    />
  );
}

function tallyJavascript(result: JavascriptSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function tallyHreflang(result: HreflangSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function tallyUrl(result: UrlSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function tallyDescription(result: DescriptionSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function tallyCanonical(result: CanonicalSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function CanonicalPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: CanonicalSuccess | null;
  failure: CanonicalFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Canonical"
          blurb="Checks the HTML and Link-header canonical, then opens that URL for redirects, noindex, robots.txt, sitemap, and alternate versions. A missing canonical still returns a scored result with a tag to paste."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError ? "This check stopped for the same reason as the message above." : "Enter a public URL and press Analyze Website."}
          </p>
        )}
      </div>
    );
  }

  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="Canonical"
      url={result.finalUrl}
      facts={`${result.canonicalUrl ? result.canonicalUrl : "No canonical"} · HTTP ${result.statusCode} · ${result.redirectCount} redirect${result.redirectCount === 1 ? "" : "s"}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => onCopy("canonical-tag", result.suggestedTag)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            {copied === "canonical-tag" ? "Copied" : "Copy tag"}
          </button>
          <button type="button" onClick={() => downloadText("biziol-canonical.txt", buildCanonicalReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-canonical.csv", buildCanonicalCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Tag to paste</p>
          <p className="mt-2 break-all font-mono text-xs leading-5 text-ink">{result.suggestedTag}</p>
          <p className="mt-2 text-xs leading-5 text-muted">Put one rel=canonical in the head. Match the Link header if you send one.</p>
        </div>
      }
    />
  );
}

function tallyKeyword(result: KeywordSuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function DescriptionPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: DescriptionSuccess | null;
  failure: DescriptionFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Meta Description"
          blurb="Checks whether the meta description is present, the right length, keyword-ready, and clean for search snippets. A missing description still returns a scored result with the first paragraph as a hint."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError ? "This check stopped for the same reason as the message above." : "Enter a public URL and press Analyze Website."}
          </p>
        )}
      </div>
    );
  }

  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="Meta Description"
      url={result.finalUrl}
      facts={`${result.measurements.characters} characters · ${result.measurements.words} words · ${result.measurements.desktopPx}px desktop / ${result.measurements.mobilePx}px mobile · ${result.descriptionCount} tag${result.descriptionCount === 1 ? "" : "s"}${result.keyword ? ` · Keyword “${result.keyword}”` : ""}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button
            type="button"
            onClick={() => onCopy("meta-description", result.description || result.firstParagraph)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold"
            disabled={!result.description && !result.firstParagraph}
          >
            {copied === "meta-description" ? "Copied" : result.description ? "Copy description" : "Copy first paragraph"}
          </button>
          <button type="button" onClick={() => downloadText("biziol-meta-description.txt", buildDescriptionReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-meta-description.csv", buildDescriptionCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 space-y-3 lg:w-[340px]">
          <SerpPreview
            title={result.title || "Untitled page"}
            cut={result.title ? result.title.length : 0}
            description={result.description || null}
            finalUrl={result.finalUrl}
            label="Desktop preview"
            limit={DESC_DESKTOP}
            frame="rounded-2xl border border-line bg-[#f8fafc] p-3"
          />
        </div>
      }
    />
  );
}

function KeywordPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: KeywordSuccess | null;
  failure: KeywordFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Focus Keyword"
          blurb="Checks where the focus keyword sits on the page, how often it is used, and related terms found in the live HTML. Volume and competitor APIs are not used."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError ? "This check stopped for the same reason as the message above." : "Enter a public URL and press Analyze Website. Focus Keyword is taken from the page H1 or title."}
          </p>
        )}
      </div>
    );
  }

  const sourceLabel =
    result.keywordSource === "h1" ? "from H1" : result.keywordSource === "title" ? "from title" : "from page";

  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="Focus Keyword"
      url={result.finalUrl}
      facts={`“${result.keyword}” (${sourceLabel}) · Density ${result.density.toFixed(1)}% · ${result.exactCount} exact uses · ${result.wordCount} words${result.secondary.length ? ` · Secondary ${result.secondary.length}` : ""}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => onCopy("focus-keyword", result.keyword)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            {copied === "focus-keyword" ? "Copied" : "Copy keyword"}
          </button>
          <button type="button" onClick={() => downloadText("biziol-focus-keyword.txt", buildKeywordReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-focus-keyword.csv", buildKeywordCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Usage map</p>
          <p className="mt-2 text-sm font-semibold text-ink">{result.keyword}</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            {result.keywordSource === "h1"
              ? "Focus keyword taken from the page H1."
              : result.keywordSource === "title"
                ? "Focus keyword taken from the page title."
                : "Focus keyword taken from the page."}{" "}
            Exact uses {result.exactCount}. Density {result.density.toFixed(1)}%. Variant hits {result.variantCount}.
          </p>
          {result.secondary.length ? <p className="mt-2 text-xs leading-5 text-muted">Secondary from H2s: {result.secondary.join(", ")}</p> : null}
        </div>
      }
    />
  );
}

function JavascriptPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: JavascriptSuccess | null;
  failure: JavascriptFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading title="JavaScript SEO" blurb="Compares the raw HTML with the page after JavaScript runs, then scores rendering, links, meta, schema, and blocked files." counts={null} />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError ? "This check stopped for the same reason as the message above." : "Enter a public URL and press Audit Website."}
          </p>
        )}
      </div>
    );
  }
  const mode = result.rendering === "csr" ? "Client-side only" : result.rendering === "ssr" ? "Server rendered" : "Render unavailable";
  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="JavaScript SEO"
      url={result.finalUrl}
      facts={`${mode} · raw ${result.rawWords} words · rendered ${result.renderedWords} words · render ${result.renderMs} ms`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => downloadText("biziol-javascript-seo.txt", buildJavascriptReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-javascript-seo.csv", buildJavascriptCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Raw vs rendered</p>
          <p className="mt-2 text-sm font-semibold text-ink">{mode}</p>
          <p className="mt-2 text-xs leading-5 text-muted">Raw HTML {result.rawWords} words. After JavaScript {result.renderedWords} words. Render took {result.renderMs} ms.</p>
        </div>
      }
    />
  );
}

function HreflangPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: HreflangSuccess | null;
  failure: HreflangFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div>
        <div className="px-5 py-5 sm:px-6">
          <PanelHeading title="Hreflang" blurb="Checks language codes, full URLs, return links, x-default, canonical, and indexability on the live versions." counts={null} />
          {failure && !sameError ? (
            <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
              <p className="text-sm font-semibold text-clay">{failure.error}</p>
              <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
              {sameError ? "This check stopped for the same reason as the message above." : "Enter a public URL and press Audit Website. One page, or a sitemap."}
            </p>
          )}
        </div>
        <HreflangGenerator copied={copied} onCopy={onCopy} />
      </div>
    );
  }
  return (
    <div>
      <CheckBoard
        score={result.score}
        grade={result.grade}
        headline="Hreflang"
        url={result.finalUrl}
        facts={`${result.mode === "sitemap" ? "Sitemap" : "Page"} · opened ${result.opened} · declared ${result.declared}`}
        copied={copied}
        onCopy={onCopy}
        checks={result.checks.map((item) => ({
          id: item.id,
          parameter: item.parameter,
          status: item.status,
          found: item.found,
          fix: item.fix,
          details: item.details,
        }))}
        actions={
          <>
            <button type="button" onClick={() => downloadText("biziol-hreflang.txt", buildHreflangReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              Download report
            </button>
            <button type="button" onClick={() => downloadText("biziol-hreflang.csv", buildHreflangCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              Download CSV
            </button>
            <button type="button" onClick={() => onCopy("hreflang-live-html", result.html)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              {copied === "hreflang-live-html" ? "Copied" : "Copy HTML tags"}
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              Save PDF
            </button>
          </>
        }
        aside={<HreflangMap result={result} />}
      />
      <HreflangGenerator copied={copied} onCopy={onCopy} />
    </div>
  );
}

function UrlPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: UrlSuccess | null;
  failure: UrlFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="URL Structure"
          blurb="Every valid URL gets the string checks. Technical checks run only when the page can be reached. A redirect is judged on the final URL."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError ? "This check stopped for the same reason as the message above." : "Enter a public URL and press Analyze Website."}
          </p>
        )}
      </div>
    );
  }

  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      headline="URL Structure"
      url={result.finalUrl}
      facts={`${result.reached ? `HTTP ${result.statusCode} · ${result.redirectCount} ${result.redirectCount === 1 ? "redirect" : "redirects"}` : "Not reached"} · Slug ${result.slug || "none"}${result.keyword ? ` · Keyword “${result.keyword}”` : ""}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => onCopy("clean-url", result.cleanUrl)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            {copied === "clean-url" ? "Copied" : "Copy clean URL"}
          </button>
          <button type="button" onClick={() => downloadText("biziol-url-structure.txt", buildUrlReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-url-structure.csv", buildUrlCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Suggested clean URL</p>
          <p className="mt-2 break-all text-sm font-semibold text-[#2563eb]">{result.cleanUrl}</p>
          <p className="mt-2 text-xs leading-5 text-muted">Hyphens, lowercase, https, and no tracking parameters.</p>
        </div>
      }
    />
  );
}

function tallyReadability(result: ReadabilitySuccess) {
  return {
    errors: result.checks.filter((item) => item.status === "error").length,
    warnings: result.checks.filter((item) => item.status === "warning").length,
    passed: result.checks.filter((item) => item.status === "pass").length,
  };
}

function ReadabilityPanel({
  result,
  failure,
  pageError,
  copied,
  onCopy,
}: {
  result: ReadabilitySuccess | null;
  failure: ReadabilityFailure | null;
  pageError: string | null;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!result) {
    const sameError = Boolean(failure && pageError && failure.error === pageError);
    return (
      <div className="px-5 py-5 sm:px-6">
        <PanelHeading
          title="Readability"
          blurb="Only the main text is scored. Under 100 words, only the reading scores count. Hindi skips the English formula."
          counts={null}
        />
        {failure && !sameError ? (
          <div className="mt-5 rounded-xl border border-[#f3c7c3] bg-[#fff6f5] px-4 py-3" role="alert">
            <p className="text-sm font-semibold text-clay">{failure.error}</p>
            <p className="mt-1 text-sm text-ink/80">{failure.hint}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-[#f8fafc] px-4 py-5 text-sm leading-6 text-muted">
            {sameError
              ? "This check stopped for the same reason as the message above."
              : "Enter a public URL and press Analyze Website."}
          </p>
        )}
      </div>
    );
  }

  const ease = result.flesch == null ? "Not calculated" : String(Math.round(result.flesch * 10) / 10);
  const gradeLevel = result.gradeLevel == null ? "Not calculated" : String(Math.round(result.gradeLevel * 10) / 10);
  return (
    <CheckBoard
      score={result.score}
      grade={result.grade}
      emptyRing="Not scored"
      headline="Readability"
      url={result.source === "page" ? result.finalUrl : undefined}
      facts={`${result.source === "text" ? "Pasted text" : `HTTP ${result.statusCode} · ${result.responseMs} ms`} · ${result.wordCount} words · ${result.sentenceCount} sentences · ${result.language === "hi" ? "Hindi" : "English"}`}
      copied={copied}
      onCopy={onCopy}
      checks={result.checks.map((item) => ({
        id: item.id,
        parameter: item.parameter,
        status: item.status,
        found: item.found,
        fix: item.fix,
        details: item.details,
      }))}
      actions={
        <>
          <button type="button" onClick={() => downloadText("biziol-readability.txt", buildReadabilityReport(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download report
          </button>
          <button type="button" onClick={() => downloadText("biziol-readability.csv", buildReadabilityCsv(result))} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
            Save PDF
          </button>
        </>
      }
      aside={
        <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">This text</p>
          <p className="mt-2 text-sm font-semibold">{result.score == null ? "Score skipped" : `Reading ease ${ease}`}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Grade {gradeLevel}. {result.wordCount} words.
          </p>
        </div>
      }
    />
  );
}

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

function downloadReport(result: AnalyzeSuccess) {
  const blob = new Blob([buildReport(result)], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "biziol-meta-title.txt";
  link.click();
  URL.revokeObjectURL(href);
}
