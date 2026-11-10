import type { AnalyzeSuccess } from "./types";

export function buildReport(result: AnalyzeSuccess) {
  const lines = [
    "biziol · Meta Title Checker",
    `Score: ${result.score}/100 (${result.grade})`,
    `Checked: ${result.checkedAt}`,
    `Requested URL: ${result.inputUrl}`,
    `Final URL: ${result.finalUrl}`,
    `HTTP ${result.statusCode} · ${result.responseMs} ms · ${result.redirectCount} redirect${result.redirectCount === 1 ? "" : "s"}`,
    "",
    `Title: ${result.title || "(empty)"}`,
    `Characters: ${result.measurements.characters}`,
    `Words: ${result.measurements.words}`,
    `Pixel width: ${result.measurements.desktopPx}px (Arial 20px)`,
    `Desktop cut-off: ${result.measurements.desktopPx > 600 ? "over 600px" : "within 600px"}`,
    `Mobile cut-off: ${result.measurements.mobilePx > 620 ? "over 620px" : "within 620px"}`,
    `H1: ${result.h1 || "(none)"}`,
    `og:title: ${result.ogTitle || "(none)"}`,
    `Meta description: ${result.metaDescription || "(none)"}`,
    `Brand from domain: ${result.brand || "(not available)"}`,
    "",
    "Top fixes",
  ];

  if (result.topIssues.length === 0) {
    lines.push("None. Every scored check passed.");
  } else {
    result.topIssues.forEach((issue, index) => {
      lines.push(`${index + 1}. ${issue.parameter} (${issue.badge}, ${issue.points})`);
      lines.push(`   Found: ${issue.found}`);
      lines.push(`   Fix: ${issue.fix}`);
    });
  }

  lines.push("", "All checks");
  for (const check of result.checks) {
    const points = check.points > 0 ? `+${check.points}` : String(check.points);
    lines.push(`- ${check.parameter}: ${check.badge} (${points})`);
    lines.push(`  Ideal: ${check.ideal}`);
    lines.push(`  Found: ${check.found}`);
    lines.push(`  Fix: ${check.fix ?? "No change."}`);
  }

  lines.push(
    "",
    "Pixel width is measured in Arial at 20px. Desktop fails over 600px. Mobile warns over 620px.",
    "Only public pages can be checked.",
  );
  return lines.join("\n");
}
