"use client";

import { useMemo, useState } from "react";
import { evaluateHreflang } from "@/lib/hreflang/checks";
import { renderHeader, renderHtml, renderXml } from "@/lib/hreflang/output";
import { isFullUrl } from "@/lib/hreflang/parse";
import type { HreflangLink, HreflangSuccess, PageEvidence } from "@/lib/hreflang/types";

export function HreflangMap({ result }: { result: HreflangSuccess }) {
  const edges = result.edges.slice(0, 12);
  return (
    <div className="w-full shrink-0 rounded-2xl border border-line bg-white px-4 py-4 lg:w-[340px]">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Link map</p>
      <p className="mt-2 text-sm font-semibold text-ink">{result.mode === "sitemap" ? "Sitemap cluster" : "Live versions"}</p>
      <p className="mt-1 text-xs leading-5 text-muted">Opened {result.opened}. Declared targets {result.declared}. A missing return link is marked in red.</p>
      {edges.length === 0 ? <p className="mt-3 text-xs leading-5 text-muted">This page did not declare any hreflang links.</p> : null}
      <ul className="mt-3 grid gap-1.5">
        {edges.map((edge) => (
          <li key={`${edge.from}-${edge.code}-${edge.to}`} className={`rounded-lg px-2 py-1.5 text-[11px] leading-4 ${edge.back ? "bg-[#f4fbf6] text-[#166534]" : "bg-[#fff1f0] text-[#b42318]"}`}>
            <span className="font-semibold">{edge.code}</span> {short(edge.from)} → {short(edge.to)}
            {edge.back ? "" : " · no return"}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HreflangGenerator({ onCopy, copied }: { onCopy: (id: string, text: string) => void; copied: string | null }) {
  const [pattern, setPattern] = useState("https://example.com/{lang}/page");
  const [codes, setCodes] = useState("en, hi-IN, fr");
  const [rows, setRows] = useState<HreflangLink[]>([]);
  const [fallback, setFallback] = useState(true);

  const review = useMemo(() => (rows.length ? evaluateHreflang(asPages(rows)) : null), [rows]);
  const problems = review?.checks.filter((item) => item.status === "error" || item.status === "warning") ?? [];

  function build() {
    const list = codes
      .split(/[\s,]+/)
      .map((code) => code.trim())
      .filter(Boolean);
    const next = list.map((code) => ({
      code,
      href: pattern.replaceAll("{lang}", code.split("-")[0] || code).replaceAll("{hreflang}", code),
    }));
    if (fallback && next[0]) next.push({ code: "x-default", href: next[0].href });
    setRows(next);
  }

  function readCsv(value: string) {
    const next = value
      .split(/\n+/)
      .map((line) => line.split(/[,;\t]/).map((part) => part.trim()))
      .filter((parts) => parts[0] && parts[1])
      .map(([code, href]) => ({ code: code || "", href: href || "" }));
    if (next.length) setRows(next.slice(0, 100));
  }

  const html = renderHtml(rows);
  const xml = renderXml(rows);
  const header = renderHeader(rows);

  return (
    <div className="border-t border-line px-5 py-5 sm:px-6">
      <h3 className="text-base font-semibold text-ink">Generate the tags</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
        Build up to 100 URLs from a pattern, a row list, or CSV. The same checks run on the codes and URLs. Auditing a live URL is what opens each version for status, return links, canonical, and indexability.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted">URL pattern</span>
          <input value={pattern} onChange={(event) => setPattern(event.target.value)} className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-[#2563eb]" />
          <span className="mt-1 block text-[11px] text-muted">Use {"{lang}"} for en or hi, and {"{hreflang}"} for the full code. Examples: /{"{lang}"}/, {"{lang}"}.site.com, site.co.uk.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-medium text-muted">Codes</span>
          <input value={codes} onChange={(event) => setCodes(event.target.value)} className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-[#2563eb]" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} />
          Add x-default on the first URL
        </label>
        <button type="button" onClick={build} className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white">
          Build URLs
        </button>
      </div>
      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-muted">Or paste CSV: code, url</span>
        <textarea onChange={(event) => readCsv(event.target.value)} rows={3} placeholder={"en,https://example.com/en\nhi-IN,https://example.com/hi"} className="w-full rounded-xl border border-line px-3 py-2 font-mono text-xs outline-none focus:border-[#2563eb]" />
      </label>
      {rows.length > 0 ? (
        <div className="mt-4">
          <ul className="grid gap-1.5">
            {rows.slice(0, 12).map((row) => (
              <li key={`${row.code}-${row.href}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs">
                <span className="font-semibold text-ink">{row.code}</span>
                <span className={`truncate ${isFullUrl(row.href) ? "text-muted" : "text-[#b42318]"}`}>{row.href}</span>
              </li>
            ))}
          </ul>
          {rows.length > 12 ? <p className="mt-2 text-xs text-muted">{rows.length - 12} more rows are included in the copy output.</p> : null}
          {problems.length > 0 ? (
            <ul className="mt-3 grid gap-1">
              {problems.map((item) => (
                <li key={item.id} className={`text-xs ${item.status === "error" ? "text-[#b42318]" : "text-[#b45309]"}`}>
                  {item.parameter}: {item.found}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs font-semibold text-[#166534]">Codes, URLs, duplicates, and x-default passed for this set.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onCopy("hreflang-html", html)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              {copied === "hreflang-html" ? "Copied" : "Copy HTML tags"}
            </button>
            <button type="button" onClick={() => onCopy("hreflang-xml", xml)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              {copied === "hreflang-xml" ? "Copied" : "Copy XML sitemap"}
            </button>
            <button type="button" onClick={() => onCopy("hreflang-header", header ? `Link: ${header}` : "")} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold">
              {copied === "hreflang-header" ? "Copied" : "Copy HTTP header"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function asPages(rows: HreflangLink[]): PageEvidence[] {
  return rows.slice(0, 100).map((row) => ({
    url: isFullUrl(row.href) ? row.href : "https://example.com/relative",
    statusCode: 200,
    redirectedTo: "",
    canonical: isFullUrl(row.href) ? row.href : "",
    noindex: false,
    robotsBlocked: false,
    htmlLinks: rows,
    headerLinks: [],
    sitemapLinks: [],
    fetchError: "",
    opened: true,
  }));
}

function short(url: string) {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`.replace(/\/$/, "") || "/";
    return `${parsed.host}${path}`.slice(0, 42);
  } catch {
    return url.slice(0, 42);
  }
}
