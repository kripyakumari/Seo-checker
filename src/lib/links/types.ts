export type CheckStatus = "pass" | "warning" | "error" | "info";

export type LinkMode = "page" | "site";

export type LinkPlace = "body" | "nav" | "footer" | "aside";

export type FoundLink = {
  href: string;
  text: string;
  empty: boolean;
  vague: boolean;
  nofollow: boolean;
  insecure: boolean;
  parameterized: boolean;
  self: boolean;
  place: LinkPlace;
  shallow: boolean;
};

export type TargetProbe = {
  url: string;
  status: number | null;
  redirects: number;
  finalUrl: string;
  noindex: boolean;
  canonicalElsewhere: boolean;
  error: string | null;
};

export type CrawledPage = {
  url: string;
  depth: number;
  out: string[];
};

export type SiteCrawl = {
  pages: CrawledPage[];
  capped: boolean;
  homeFetched: boolean;
  sitemapUrls: string[];
};

export type LinkCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type LinkEvaluation = {
  score: number;
  grade: string;
  linkCount: number;
  bodyCount: number;
  checks: LinkCheck[];
};

export type LinkSuccess = LinkEvaluation & {
  ok: true;
  mode: LinkMode;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  keyword: string;
  crawledPages: number;
  checkedAt: string;
};

export type LinkFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type LinkResult = LinkSuccess | LinkFailure;
