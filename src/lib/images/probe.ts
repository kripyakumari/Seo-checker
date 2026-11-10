import { readPixelSize, sniffFormat } from "./dimensions";
import type { FoundImage } from "./extract";
import { FetchError, assertPublic } from "./public-url";

const MAX_IMAGES = 24;
const POOL = 4;
const READ_BYTES = 256 * 1024;
const TIMEOUT_MS = 8_000;

export type MeasuredImage = FoundImage & {
  statusCode: number | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  format: string;
  fetchError: string | null;
};

export async function measureImages(images: FoundImage[]): Promise<MeasuredImage[]> {
  return mapPool(images.slice(0, MAX_IMAGES), POOL, measureOne);
}

export async function fetchRobotsBlocked(pageUrl: string, imageUrls: string[]) {
  const origins = new Map<string, string[]>();
  for (const imageUrl of imageUrls) {
    try {
      const parsed = new URL(imageUrl);
      const list = origins.get(parsed.origin) ?? [];
      list.push(imageUrl);
      origins.set(parsed.origin, list);
    } catch {
      /* skip a URL that cannot be parsed */
    }
  }

  const blocked = new Set<string>();
  const hosts = [...origins.entries()].slice(0, 6);
  await mapPool(hosts, 3, async ([origin, urls]) => {
    let text = "";
    try {
      text = await fetchText(`${origin}/robots.txt`);
    } catch {
      return;
    }
    const rules = starDisallows(text);
    if (rules.length === 0) return;
    for (const imageUrl of urls) {
      const path = new URL(imageUrl).pathname;
      if (rules.some((rule) => path === rule || path.startsWith(rule))) blocked.add(imageUrl);
    }
  });
  return blocked;
}

async function measureOne(image: FoundImage): Promise<MeasuredImage> {
  try {
    return { ...image, ...(await fetchImage(image.url)) };
  } catch (error) {
    const message = error instanceof FetchError ? error.message : "The image could not be read.";
    return {
      ...image,
      statusCode: null,
      bytes: null,
      width: null,
      height: null,
      format: sniffFormat(new Uint8Array(), null, image.url),
      fetchError: message,
    };
  }
}

async function fetchImage(url: string) {
  let current = url;
  let retried = false;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(current);
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", "User-Agent": browserAgent() },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop === 3) {
        return emptyRead(response.status, current);
      }
      current = new URL(location, current).toString();
      continue;
    }

    if ((response.status === 429 || response.status === 503) && !retried) {
      await response.body?.cancel();
      retried = true;
      hop -= 1;
      await delay(900);
      continue;
    }

    if (response.status >= 400) {
      await response.body?.cancel();
      return emptyRead(response.status, current);
    }

    const declared = Number(response.headers.get("content-length"));
    const { bytes, truncated } = await readCap(response, READ_BYTES);
    const format = sniffFormat(bytes, response.headers.get("content-type"), current);
    const size = readPixelSize(bytes, format);
    const fileBytes = Number.isFinite(declared) && declared >= 0 ? declared : truncated ? null : bytes.byteLength;
    return {
      statusCode: response.status,
      bytes: fileBytes,
      width: size.width,
      height: size.height,
      format,
      fetchError: null,
      url: current,
    };
  }
  return emptyRead(null, current);
}

async function fetchText(url: string) {
  await assertPublic(url);
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "text/plain,*/*;q=0.8", "User-Agent": browserAgent() },
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) return "";
    return fetchText(new URL(location, url).toString());
  }
  if (!response.ok) {
    await response.body?.cancel();
    return "";
  }
  const { bytes } = await readCap(response, 200_000);
  return Buffer.from(bytes).toString("utf8");
}

function emptyRead(statusCode: number | null, url: string) {
  return {
    statusCode,
    bytes: null,
    width: null,
    height: null,
    format: sniffFormat(new Uint8Array(), null, url),
    fetchError: null,
    url,
  };
}

function starDisallows(text: string) {
  const groups: { agents: string[]; rules: string[] }[] = [];
  let current: { agents: string[]; rules: string[] } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const agent = line.match(/^user-agent\s*:\s*(.*)$/i);
    if (agent) {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(agent[1].trim().toLowerCase());
      continue;
    }
    if (!current) continue;
    const disallow = line.match(/^disallow\s*:\s*(.*)$/i);
    if (disallow) current.rules.push(disallow[1].trim());
  }
  return groups
    .filter((group) => group.agents.includes("*"))
    .flatMap((group) => group.rules)
    .filter((rule) => rule.length > 0 && rule !== "/");
}

async function readCap(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(), truncated: false };
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  while (received < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received + value.byteLength > limit) {
      chunks.push(value.subarray(0, limit - received));
      received = limit;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

async function mapPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
  return results;
}

function browserAgent() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
