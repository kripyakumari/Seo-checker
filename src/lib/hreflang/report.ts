import type { HreflangSuccess } from "./types";

export function buildHreflangReport(result: HreflangSuccess) {
  const lines = [
    "biziol hreflang",
    result.finalUrl,
    `Score ${result.score} / 100 · ${result.grade}`,
    `${result.mode === "sitemap" ? "Sitemap" : "Page"} · opened ${result.opened} · declared ${result.declared}`,
    "",
  ];
  for (const item of result.checks) {
    lines.push(`${label(item.status)} · ${item.parameter}`);
    lines.push(item.found);
    if (item.fix) lines.push(item.fix);
    if (item.details) lines.push(item.details);
    lines.push("");
  }
  if (result.html) {
    lines.push("HTML");
    lines.push(result.html);
    lines.push("");
  }
  if (result.header) {
    lines.push("HTTP header");
    lines.push(`Link: ${result.header}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildHreflangCsv(result: HreflangSuccess) {
  const rows = [["Parameter", "Ideal", "Status", "Found", "Suggestion"]];
  for (const item of result.checks) {
    rows.push([item.parameter, item.ideal, label(item.status), item.found, item.fix ?? ""]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function label(status: string) {
  if (status === "error") return "Error";
  if (status === "warning") return "Warning";
  if (status === "pass") return "Passed";
  return "Info";
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
