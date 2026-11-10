import { isIP } from "node:net";
import { isBlockedHostname } from "./network";

export type PreparedUrl =
  | { ok: true; url: string }
  | { ok: false; error: string; hint: string };

export function prepareUrl(raw: string): PreparedUrl {
  const trimmed = raw.normalize("NFKC").trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Enter a website URL.",
      hint: "Use a domain such as example.com.",
    };
  }
  if (trimmed.length > 2000) {
    return {
      ok: false,
      error: "That URL is too long.",
      hint: "Paste the main page address, without a long tracking string if you can.",
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      ok: false,
      error: "The URL contains spaces.",
      hint: "Remove the spaces and try again.",
    };
  }

  let candidate = trimmed;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      ok: false,
      error: "This URL is not valid.",
      hint: "Use a full domain such as example.com.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "Remove the username and password from the URL.",
      hint: "Check the public page address, not a login link.",
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return {
      ok: false,
      error: "Only http and https pages can be checked.",
      hint: "Paste a normal website address.",
    };
  }

  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (!host || host.includes(" ")) {
    return {
      ok: false,
      error: "This URL has no domain.",
      hint: "Use a domain such as example.com.",
    };
  }
  if (isBlockedHostname(host)) {
    return {
      ok: false,
      error: "That address is not a public website.",
      hint: "Enter a public domain such as example.com.",
    };
  }
  if (!host.includes(".") && !isIP(host)) {
    return {
      ok: false,
      error: "This URL needs a full domain.",
      hint: "Use a domain such as example.com, not a single word.",
    };
  }

  parsed.hash = "";
  parsed.hostname = host;
  return { ok: true, url: parsed.toString() };
}

const MULTI_PART_TLDS = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.nz", "co.in", "com.br", "co.za", "com.mx", "co.jp", "com.sg", "com.tr"]);

/** Brand label taken from the registrable domain, ignoring www and the TLD. */
export function brandFromUrl(url: string) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/\.$/, "").replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
  if (!host || isIP(host)) return "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) return parts[parts.length - 3];
  return parts[parts.length - 2];
}
