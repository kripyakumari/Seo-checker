export type CheckStatus = "pass" | "warning" | "error" | "info";

export type KeywordCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type KeywordPage = {
  title: string;
  h1: string[];
  h2: string[];
  headings: string[];
  metaDescription: string;
  slug: string;
  alts: string[];
  paragraphs: string[];
  bodyText: string;
  wordCount: number;
};

export type KeywordSource = "entered" | "h1" | "title";

export type KeywordEvaluation = {
  score: number;
  grade: string;
  density: number;
  exactCount: number;
  variantCount: number;
  checks: KeywordCheck[];
};

export type KeywordSuccess = KeywordEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  keyword: string;
  keywordSource: KeywordSource;
  secondary: string[];
  title: string;
  wordCount: number;
  checkedAt: string;
};

export type KeywordFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type KeywordResult = KeywordSuccess | KeywordFailure;
