import type { JavascriptSuccess } from "./types";

export function buildJavascriptReport(result: JavascriptSuccess) {
  const lines = [
    "biziol javascript seo",
    result.finalUrl,
    `Score ${result.score} / 100 · ${result.grade}`,
    `Rendering ${result.rendering} · raw ${result.rawWords} words · rendered ${result.renderedWords} words · render ${result.renderMs} ms`,
    "",
  ];
  for (const item of result.checks) {
    lines.push(`${label(item.status)} · ${item.parameter}`);
    lines.push(item.found);
    if (item.fix) lines.push(item.fix);
    if (item.details) lines.push(item.details);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildJavascriptCsv(result: JavascriptSuccess) {
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
