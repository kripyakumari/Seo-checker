export type CheckStatus = "pass" | "warning" | "error" | "info";

export type HeadingCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type FoundHeading = {
  level: number;
  text: string;
  empty: boolean;
  hidden: boolean;
  styled: boolean;
};

export type OutlineNode = {
  level: number;
  text: string;
  children: OutlineNode[];
};

export type HeadingEvaluation = {
  score: number;
  grade: string;
  headingCount: number;
  h1Count: number;
  wordCount: number;
  checks: HeadingCheck[];
  outline: OutlineNode[];
  headings: FoundHeading[];
};

export type HeadingSuccess = HeadingEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  keyword: string;
  title: string;
  checkedAt: string;
};

export type HeadingFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type HeadingResult = HeadingSuccess | HeadingFailure;
