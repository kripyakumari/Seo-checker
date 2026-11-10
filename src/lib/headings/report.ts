import type { HeadingSuccess, OutlineNode } from "./types";

export function buildHeadingReport(result: HeadingSuccess) {
  const lines = [
    "biziol header tags",
    result.finalUrl,
    `Score ${result.score} / 100 · ${result.grade}`,
    `Headings ${result.headingCount}`,
    `H1 ${result.h1Count}`,
    "",
    "Outline",
    buildOutlineText(result.outline),
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

export function buildHeadingCsv(result: HeadingSuccess) {
  const rows = [["Parameter", "Ideal", "Status", "Found", "Suggestion"]];
  for (const item of result.checks) {
    rows.push([item.parameter, item.ideal, label(item.status), item.found, item.fix ?? ""]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function buildOutlineText(nodes: OutlineNode[], depth = 0): string {
  return nodes
    .map((node) => `${"  ".repeat(depth)}H${node.level} ${node.text}${node.children.length ? `\n${buildOutlineText(node.children, depth + 1)}` : ""}`)
    .join("\n");
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
