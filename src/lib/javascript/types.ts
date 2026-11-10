export type CheckStatus = "pass" | "warning" | "error" | "info";

export type JavascriptCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type JsonLdBlock = {
  valid: boolean;
  text: string;
};

export type ImageSignal = {
  src: string;
  loading: string;
  dataSrc: boolean;
};

export type JsSnapshot = {
  statusCode: number;
  finalUrl: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  h1: string[];
  text: string;
  wordCount: number;
  prices: string[];
  internalLinks: string[];
  realLinks: number;
  weakLinks: number;
  jsonLd: JsonLdBlock[];
  images: ImageSignal[];
  scripts: string[];
  stylesheets: string[];
  emptyRoot: boolean;
};

export type FailedAsset = {
  url: string;
  status: number | null;
  reason: string;
};

export type RenderCapture = {
  ok: boolean;
  html: string;
  finalUrl: string;
  statusCode: number;
  renderMs: number;
  consoleErrors: string[];
  failedAssets: FailedAsset[];
  scriptBytes: number;
  error: string;
};

export type JavascriptEvaluation = {
  score: number;
  grade: string;
  rendering: "ssr" | "csr" | "unknown";
  rawWords: number;
  renderedWords: number;
  checks: JavascriptCheck[];
};

export type JavascriptSuccess = JavascriptEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  renderMs: number;
  checkedAt: string;
};

export type JavascriptFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type JavascriptResult = JavascriptSuccess | JavascriptFailure;
