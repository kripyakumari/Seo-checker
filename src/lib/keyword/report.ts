import type { KeywordSuccess } from "./types";

export function buildKeywordReport(result: KeywordSuccess) {
  const lines = [
    "biziol focus keyword",
    result.finalUrl,
    `Focus keyword: ${result.keyword} (${result.keywordSource})`,
    result.secondary.length ? `Secondary: ${result.secondary.join(", ")}` : "Secondary: none",
    `Score ${result.score} / 100 · ${result.grade}`,
    `Density ${result.density.toFixed(1)}% · ${result.exactCount} exact uses · ${result.wordCount} words`,
    "",
  ];
  for (const item of result.checks) {
    lines.push(`${label(item.status)} · ${item.parameter}`);
    lines.push(item.found);
    if (item.fix) lines.push(item.fix);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildKeywordCsv(result: KeywordSuccess) {
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
