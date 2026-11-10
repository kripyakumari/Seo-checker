export type CheckStatus = "pass" | "warning" | "error" | "info";

export type Check = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  badge: string;
  found: string;
  fix: string | null;
  /** Negative numbers are penalties. */
  points: number;
};

export type TitleMeasurements = {
  characters: number;
  words: number;
  desktopPx: number;
  mobilePx: number;
  /** Index in the title where the desktop snippet cuts. Equal to the length when it fits. */
  desktopCut: number;
  mobileCut: number;
};

export type Evaluation = {
  title: string;
  measurements: TitleMeasurements;
  checks: Check[];
  topIssues: Check[];
  score: number;
  grade: string;
  /** 100 + points before the 0–100 cap. */
  uncapped: number;
  capped: boolean;
};

export type AnalyzeSuccess = Evaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  titleCount: number;
  h1: string | null;
  h1Count: number;
  ogTitle: string | null;
  metaDescription: string | null;
  keyword: string;
  brand: string;
  checkedAt: string;
};

export type AnalyzeFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type AnalyzeResult = AnalyzeSuccess | AnalyzeFailure;
