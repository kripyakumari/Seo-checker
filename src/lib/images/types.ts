export type CheckStatus = "pass" | "warning" | "error" | "info";

export type ImageCheck = {
  id: string;
  parameter: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  /** Info and pass are 0. Warnings and errors are negative. */
  points: number;
};

export type ImageRow = {
  id: string;
  url: string;
  name: string;
  alt: string | null;
  bytes: number | null;
  format: string;
  width: number | null;
  height: number | null;
  decorative: boolean;
  cssOnly: boolean;
  ogOnly: boolean;
  scored: boolean;
  status: CheckStatus;
  issue: string;
  fix: string | null;
  score: number;
  checks: ImageCheck[];
};

export type ImageEvaluation = {
  score: number;
  grade: string;
  contentCount: number;
  listedCount: number;
  totalBytes: number;
  checks: ImageCheck[];
  images: ImageRow[];
};

export type ImageSuccess = ImageEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  keyword: string;
  checkedAt: string;
};

export type ImageFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type ImageResult = ImageSuccess | ImageFailure;
