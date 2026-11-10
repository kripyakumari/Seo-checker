export type CheckStatus = "pass" | "warning" | "error" | "info";

export type UrlCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type UrlParts = {
  href: string;
  protocol: string;
  host: string;
  pathname: string;
  decodedPath: string | null;
  doubleEncoded: boolean;
  slug: string;
  slugWords: string[];
  folders: number;
  segments: string[];
  queryKeys: string[];
  hash: string;
};

export type RedirectHop = {
  url: string;
  status: number;
};

export type UrlTechnical = {
  reached: boolean;
  hops: RedirectHop[];
  statusCode: number;
  canonical: string | null;
  /** Null when the http version was not probed. */
  httpRedirectsToHttps: boolean | null;
};

export type UrlEvaluation = {
  score: number;
  grade: string;
  checks: UrlCheck[];
  cleanUrl: string;
  slug: string;
};

export type UrlSuccess = UrlEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  reached: boolean;
  keyword: string;
  checkedAt: string;
};

export type UrlFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type UrlResult = UrlSuccess | UrlFailure;
