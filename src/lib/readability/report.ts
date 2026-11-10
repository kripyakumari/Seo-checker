import type { ReadabilitySuccess } from "./types";

export function buildReadabilityReport(result: ReadabilitySuccess) {
  const lines = [
    "biziol readability",
    result.finalUrl,
    result.score == null ? "Score skipped" : `Score ${result.score} / 100 · ${result.grade}`,
    `${result.wordCount} words · ${result.sentenceCount} sentences`,
    result.language === "hi" ? "Hindi" : "English",
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

export function buildReadabilityCsv(result: ReadabilitySuccess) {
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
