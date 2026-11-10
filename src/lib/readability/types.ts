export type CheckStatus = "pass" | "warning" | "error" | "info";

export type ReadabilityLanguage = "en" | "hi";

export type ReadabilityCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type ReadabilityBlock = {
  kind: "p" | "li" | "quote" | "h";
  level: number;
  text: string;
};

export type ReadabilityDocument = {
  wordCount: number;
  sentenceCount: number;
  flesch: number | null;
  gradeLevel: number | null;
  fog: number | null;
  averageSentence: number;
  longShare: number;
  veryLong: string[];
  sameStart: string[];
  passiveShare: number;
  transitionShare: number;
  longParagraphs: string[];
  walls: string[];
  subheadingGap: boolean;
  openingProblem: string | null;
  complexShare: number;
  fillerCount: number;
  fillerShare: number;
  repeated: string[];
  emphasis: string | null;
  spelling: string[];
  grammar: string[];
  foreign: boolean;
  headingCount: number;
};

export type ReadabilityEvaluation = {
  score: number | null;
  grade: string;
  wordCount: number;
  sentenceCount: number;
  flesch: number | null;
  gradeLevel: number | null;
  checks: ReadabilityCheck[];
};

export type ReadabilitySuccess = ReadabilityEvaluation & {
  ok: true;
  source: "page" | "text";
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  language: ReadabilityLanguage;
  checkedAt: string;
};

export type ReadabilityFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type ReadabilityResult = ReadabilitySuccess | ReadabilityFailure;
