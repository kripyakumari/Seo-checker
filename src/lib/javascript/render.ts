import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { isBlockedHostname } from "@/lib/meta-title/network";
import type { FailedAsset, RenderCapture } from "./types";

const GOOGLEBOT_SMARTPHONE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.204 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const EMPTY: RenderCapture = {
  ok: false,
  html: "",
  finalUrl: "",
  statusCode: 0,
  renderMs: 0,
  consoleErrors: [],
  failedAssets: [],
  scriptBytes: 0,
  error: "",
};

export function chromePath() {
  const fromEnv = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "";
  const candidates = [
    fromEnv,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((path) => path && existsSync(path)) || "";
}

export async function renderPage(url: string): Promise<RenderCapture> {
  const executablePath = chromePath();
  if (!executablePath) {
    return { ...EMPTY, error: "Chrome is not installed, so the page cannot be rendered with JavaScript." };
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const consoleErrors: string[] = [];
  const failedAssets: FailedAsset[] = [];
  let scriptBytes = 0;
  try {
    const page = await browser.newPage();
    await page.setUserAgent(GOOGLEBOT_SMARTPHONE);
    await page.setViewport({ width: 412, height: 732, isMobile: true, hasTouch: true });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().replace(/\s+/g, " ").trim().slice(0, 280));
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(String(error).replace(/\s+/g, " ").trim().slice(0, 280));
    });
    page.on("response", (response) => {
      const type = response.request().resourceType();
      if (type !== "script" && type !== "stylesheet") return;
      const status = response.status();
      if (status >= 400) failedAssets.push({ url: response.url(), status, reason: `HTTP ${status}` });
      if (type !== "script" || status >= 400) return;
      const length = Number(response.headers()["content-length"] || 0);
      if (Number.isFinite(length) && length > 0) {
        scriptBytes += length;
        return;
      }
      void response
        .buffer()
        .then((body) => {
          scriptBytes += body.length;
        })
        .catch(() => undefined);
    });
    page.on("requestfailed", (request) => {
      const type = request.resourceType();
      if (type !== "script" && type !== "stylesheet") return;
      failedAssets.push({ url: request.url(), status: null, reason: request.failure()?.errorText || "The file did not load" });
    });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const target = request.url();
      if (target.startsWith("data:") || target.startsWith("blob:") || target.startsWith("about:")) {
        void request.continue();
        return;
      }
      try {
        const parsed = new URL(target);
        if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || isBlockedHostname(parsed.hostname)) {
          void request.abort();
          return;
        }
      } catch {
        void request.abort();
        return;
      }
      void request.continue();
    });

    const started = Date.now();
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 22_000 });
    const html = await page.content();
    return {
      ok: true,
      html,
      finalUrl: page.url(),
      statusCode: response?.status() ?? 0,
      renderMs: Date.now() - started,
      consoleErrors: unique(consoleErrors).slice(0, 8),
      failedAssets: uniqueAssets(failedAssets).slice(0, 12),
      scriptBytes,
      error: "",
    };
  } catch (error) {
    return {
      ...EMPTY,
      consoleErrors: unique(consoleErrors).slice(0, 8),
      failedAssets: uniqueAssets(failedAssets).slice(0, 12),
      scriptBytes,
      error: error instanceof Error ? error.message : "The rendered page could not be opened.",
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueAssets(assets: FailedAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.status ?? "fail"} ${asset.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
