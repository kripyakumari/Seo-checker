import type { CanonicalSuccess } from "./types";

export function buildCanonicalReport(result: CanonicalSuccess) {
  const lines = [
    "biziol canonical",
    result.finalUrl,
    `Score ${result.score} / 100 · ${result.grade}`,
    result.canonicalUrl ? `Canonical: ${result.canonicalUrl}` : "Canonical: (missing)",
    `Suggested tag: ${result.suggestedTag}`,
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

export function buildCanonicalCsv(result: CanonicalSuccess) {
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
