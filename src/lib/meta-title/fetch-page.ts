import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedHostname, isPrivateAddress } from "./network";

const HOP_TIMEOUT_MS = 12_000;
const MAX_BYTES = 1_800_000;
const MAX_REDIRECTS = 5;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class FetchError extends Error {
  hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "FetchError";
    this.hint = hint;
  }
}

export type FetchedPage = {
  html: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  truncated: boolean;
};

export async function fetchPage(url: string): Promise<FetchedPage> {
  const started = Date.now();
  let current = url;
  let redirects = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HOP_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          throw new FetchError(
            "The page redirected without a destination.",
            "Open the URL in a browser, copy the final address, and try that.",
          );
        }
        if (redirects >= MAX_REDIRECTS) {
          throw new FetchError(
            "This URL redirected more than 5 times.",
            "Open the page in a browser, copy the final address, and check that.",
          );
        }
        const next = new URL(location, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          throw new FetchError(
            "The page redirected to an unsupported address.",
            "Check the public https page directly.",
          );
        }
        redirects += 1;
        current = next.toString();
        continue;
      }

      if (response.status >= 400 || response.status < 200) {
        await response.body?.cancel();
        throw new FetchError(
          `The page returned HTTP ${response.status}, so the title was not checked.`,
          "Fix the URL or wait until the page is public, then try again.",
        );
      }

      const contentType = response.headers.get("content-type");
      const { buffer, truncated } = await readLimited(response);
      const html = decodeHtml(buffer, contentType);
      if (!isHtml(contentType, html)) {
        throw new FetchError(
          "This URL did not return an HTML page.",
          "Point the checker at a normal web page, not a file, feed, or API.",
        );
      }
      if (!html.trim()) {
        throw new FetchError(
          "The page loaded but returned no HTML.",
          "Check the URL and try again.",
        );
      }

      return {
        html,
        finalUrl: current,
        statusCode: response.status,
        responseMs: Date.now() - started,
        redirectCount: redirects,
        truncated,
      };
    } catch (error) {
      if (error instanceof FetchError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new FetchError(
          "The page timed out before it loaded.",
          "Check the URL and try again.",
        );
      }
      throw new FetchError(
        "The site could not be reached.",
        "Check the spelling of the domain and try again.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new FetchError(
    "This URL redirected more than 5 times.",
    "Open the page in a browser, copy the final address, and check that.",
  );
}

async function assertPublic(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new FetchError(
      "This URL is not valid.",
      "Use a full domain such as example.com.",
    );
  }
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (isBlockedHostname(host)) {
    throw new FetchError(
      "That address is not a public website.",
      "Enter a public domain such as example.com.",
    );
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new FetchError(
        "That address is not a public website.",
        "Enter a public domain such as example.com.",
      );
    }
    return;
  }

  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new FetchError(
      "The site could not be reached.",
      "Check the spelling of the domain and try again.",
    );
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new FetchError(
      "That address is not a public website.",
      "Enter a public domain such as example.com.",
    );
  }
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return { buffer: new Uint8Array(), truncated: false };
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received + value.byteLength > MAX_BYTES) {
      chunks.push(value.subarray(0, MAX_BYTES - received));
      received = MAX_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { buffer, truncated };
}

function decodeHtml(buffer: Uint8Array, contentType: string | null) {
  const sniff = Buffer.from(buffer.subarray(0, 2500)).toString("latin1");
  const header = contentType?.match(/charset\s*=\s*"?([a-zA-Z0-9._-]+)/i)?.[1];
  const meta = sniff.match(/charset\s*=\s*["']?\s*([a-zA-Z0-9._-]+)/i)?.[1];
  const charset = (header || meta || "utf-8").toLowerCase();
  const label = charset === "latin1" || charset === "iso-8859-1" ? "windows-1252" : charset;
  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  }
}

function isHtml(contentType: string | null, html: string) {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/xhtml")) return true;
  if (type.includes("image/") || type.includes("pdf") || type.includes("json") || type.includes("xml")) {
    return type.includes("html") || type.includes("xml+xhtml");
  }
  const sample = html.slice(0, 1500).toLowerCase();
  return sample.includes("<html") || sample.includes("<!doctype") || sample.includes("<title") || sample.includes("<head");
}
