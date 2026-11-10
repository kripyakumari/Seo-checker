export type CheckStatus = "pass" | "warning" | "error" | "info";

export type CanonicalCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type CanonicalSource = {
  raw: string;
  resolved: string | null;
  absolute: boolean;
  inHead: boolean;
  inBody: boolean;
  fromHeader: boolean;
};

export type CanonicalProbe = {
  reached: boolean;
  statusCode: number;
  finalUrl: string;
  redirectCount: number;
  noindex: boolean;
  selfCanonical: string | null;
  robotsBlocked: boolean | null;
};

export type CanonicalEvaluation = {
  score: number;
  grade: string;
  checks: CanonicalCheck[];
  suggestedTag: string;
  canonicalUrl: string | null;
};

export type CanonicalSuccess = CanonicalEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  checkedAt: string;
};

export type CanonicalFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type CanonicalResult = CanonicalSuccess | CanonicalFailure;
