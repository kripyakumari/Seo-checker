import { parameterRows } from "./parameters";
import type { ImageSuccess } from "./types";

export function formatImageBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function buildImageReport(result: ImageSuccess) {
  const lines = [
    "biziol image optimization",
    result.finalUrl,
    `Score ${result.score} / 100 · ${result.grade}`,
    `Content images ${result.contentCount}`,
    `Total weight ${formatImageBytes(result.totalBytes)}`,
    "",
  ];
  for (const item of parameterRows(result)) {
    lines.push(`${label(item.status)} · ${item.group} · ${item.name}`);
    lines.push(item.found);
    if (item.fix) lines.push(item.fix);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildImageCsv(result: ImageSuccess) {
  const rows = [["Parameter", "Group", "Status", "Found", "Suggestion"]];
  for (const item of parameterRows(result)) {
    rows.push([item.name, item.group, label(item.status), item.found, item.fix ?? ""]);
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
