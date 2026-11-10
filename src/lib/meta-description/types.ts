export type CheckStatus = "pass" | "warning" | "error" | "info";

export type DescriptionCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type DescriptionMeasurements = {
  characters: number;
  words: number;
  desktopPx: number;
  mobilePx: number;
  desktopCut: number;
  mobileCut: number;
};

export type DescriptionEvaluation = {
  score: number;
  grade: string;
  description: string;
  measurements: DescriptionMeasurements;
  checks: DescriptionCheck[];
  topIssues: DescriptionCheck[];
};

export type DescriptionSuccess = DescriptionEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  keyword: string;
  title: string;
  descriptionCount: number;
  ogDescription: string | null;
  firstParagraph: string;
  checkedAt: string;
};

export type DescriptionFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type DescriptionResult = DescriptionSuccess | DescriptionFailure;
