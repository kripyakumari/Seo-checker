export type CheckStatus = "pass" | "warning" | "error" | "info";

export type HreflangLink = {
  code: string;
  href: string;
};

export type HreflangCheck = {
  id: string;
  parameter: string;
  ideal: string;
  status: CheckStatus;
  found: string;
  fix: string | null;
  points: number;
  details: string;
};

export type PageEvidence = {
  url: string;
  statusCode: number;
  redirectedTo: string;
  canonical: string;
  noindex: boolean;
  robotsBlocked: boolean;
  htmlLinks: HreflangLink[];
  headerLinks: HreflangLink[];
  sitemapLinks: HreflangLink[];
  fetchError: string;
  opened: boolean;
};

export type HreflangEdge = {
  from: string;
  to: string;
  code: string;
  back: boolean;
};

export type HreflangEvaluation = {
  score: number;
  grade: string;
  checks: HreflangCheck[];
  edges: HreflangEdge[];
  html: string;
  xml: string;
  header: string;
  opened: number;
  declared: number;
};

export type HreflangSuccess = HreflangEvaluation & {
  ok: true;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  responseMs: number;
  redirectCount: number;
  checkedAt: string;
  mode: "page" | "sitemap";
};

export type HreflangFailure = {
  ok: false;
  error: string;
  hint: string;
};

export type HreflangResult = HreflangSuccess | HreflangFailure;
