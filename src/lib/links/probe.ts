import { assertPublic, FetchError } from "@/lib/images/public-url";
import type { TargetProbe } from "./types";

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 80_000;
const POOL = 4;

export async function probeTargets(urls: string[]): Promise<TargetProbe[]> {
  return mapPool(urls, POOL, probeOne);
}

async function probeOne(url: string): Promise<TargetProbe> {
  try {
    const result = await follow(url, 0);
    return { ...result, url };
  } catch (error) {
    const message = error instanceof FetchError ? error.message : "The target could not be read.";
    return { url, status: null, redirects: 0, finalUrl: url, noindex: false, canonicalElsewhere: false, error: message };
  }
}

async function follow(url: string, redirects: number): Promise<TargetProbe> {
  await assertPublic(url);
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "User-Agent": "Mozilla/5.0" },
  });
  if (response.status >= 300 && response.status < 400 && redirects < 5) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) return { url, status: response.status, redirects, finalUrl: url, noindex: false, canonicalElsewhere: false, error: null };
    const next = new URL(location, url);
    return follow(next.toString(), redirects + 1);
  }
  const robotsHeader = response.headers.get("x-robots-tag") ?? "";
  const html = response.status < 400 ? await readText(response) : "";
  if (response.status >= 400) await response.body?.cancel();
  const noindex = /noindex/i.test(robotsHeader) || /<meta[^>]*(?:name|property)=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(html) || /<meta[^>]*content=["'][^"']*noindex[^"']*["'][^>]*(?:name|property)=["'](?:robots|googlebot)["']/i.test(html);
  const canonical = html.match(/<link[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["']/i)?.[1] ?? "";
  let canonicalElsewhere = false;
  if (canonical) {
    try {
      const target = new URL(response.url || url);
      const pointed = new URL(canonical, target);
      canonicalElsewhere = pointed.hostname.replace(/^www\./i, "") !== target.hostname.replace(/^www\./i, "") || pointed.pathname.replace(/\/$/, "") !== target.pathname.replace(/\/$/, "");
    } catch {
      canonicalElsewhere = false;
    }
  }
  return { url, status: response.status, redirects, finalUrl: response.url || url, noindex, canonicalElsewhere, error: null };
}

async function readText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const room = MAX_BYTES - received;
    chunks.push(value.byteLength > room ? value.subarray(0, room) : value);
    received += Math.min(value.byteLength, room);
    if (value.byteLength > room) {
      await reader.cancel();
      break;
    }
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

async function mapPool<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return results;
}
