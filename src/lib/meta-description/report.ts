import type { DescriptionSuccess } from "./types";

export function buildDescriptionReport(result: DescriptionSuccess) {
  const lines = [
    "biziol meta description",
    result.finalUrl,
    `Score ${result.score} / 100 · ${result.grade}`,
    result.description ? `Description: ${result.description}` : "Description: (missing)",
    `${result.measurements.characters} characters · ${result.measurements.words} words · ${result.measurements.desktopPx}px`,
    result.keyword ? `Focus keyword: ${result.keyword}` : "Focus keyword: none",
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

export function buildDescriptionCsv(result: DescriptionSuccess) {
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
