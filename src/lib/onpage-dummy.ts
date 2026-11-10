export type SampleStatus = "error" | "warning" | "pass";

export type SampleRow = {
  page: string;
  path: string;
  value: string;
  length: string;
  status: SampleStatus;
  issue: string;
  suggestion: string;
  improvement: string | null;
};

export type SampleTool = {
  id: string;
  name: string;
  /** Section heading in the tool list. Defaults to On-page. */
  group?: string;
  blurb: string;
  rows: SampleRow[];
};

export const SAMPLE_TOOLS: SampleTool[] = [
  {
    id: "meta-description",
    name: "Meta Description",
    blurb: "Checks whether each description is present, unique, and about 140–160 characters.",
    rows: [
      {
        page: "Home Page",
        path: "https://www.example.com",
        value: "Welcome to our website.",
        length: "24",
        status: "error",
        issue: "Description is too short",
        suggestion: "Expand it to 140–160 characters and include the primary topic.",
        improvement: "Biziol helps teams check on-page SEO, starting with the title Google actually shows.",
      },
      {
        page: "Services Page",
        path: "https://www.example.com/services",
        value: "Our services.",
        length: "13",
        status: "error",
        issue: "Missing a descriptive summary",
        suggestion: "Write a sentence that says who the service is for and what it does.",
        improvement: "On-page SEO audits for marketing teams that need a clear title, description, and headings.",
      },
      {
        page: "Blog Page",
        path: "https://www.example.com/blog",
        value: "Latest articles, guides, and notes from the team on search, content, and measurement, updated every week.",
        length: "104",
        status: "warning",
        issue: "A little short of the ideal range",
        suggestion: "Add one specific phrase so the description reaches about 150 characters.",
        improvement: "Latest SEO guides for teams who want clearer titles, descriptions, and heading structure.",
      },
      {
        page: "About Page",
        path: "https://www.example.com/about",
        value: "We help growing companies fix the on-page details that decide whether a page is understood in search.",
        length: "104",
        status: "pass",
        issue: "Meets the description checks",
        suggestion: "No change needed.",
        improvement: null,
      },
    ],
  },
  {
    id: "url",
    name: "URL Structure",
    blurb: "Checks that URLs are short, readable, lowercase, and free of tracking parameters.",
    rows: [
      {
        page: "Campaign Page",
        path: "https://www.example.com/Services_Page?ref=homepage",
        value: "Services_Page?ref=homepage",
        length: "Long",
        status: "error",
        issue: "Uppercase, an underscore, and a tracking parameter",
        suggestion: "Use a lowercase hyphenated path and drop the tracking query.",
        improvement: "https://www.example.com/services",
      },
      {
        page: "Blog Post",
        path: "https://www.example.com/blog/the-complete-guide-to-fixing-titles",
        value: "the-complete-guide-to-fixing-titles",
        length: "38 chars",
        status: "warning",
        issue: "The slug is longer than it needs to be",
        suggestion: "Shorten the slug to the main topic.",
        improvement: "/blog/fixing-titles",
      },
      {
        page: "About Page",
        path: "https://www.example.com/about",
        value: "/about",
        length: "Short",
        status: "pass",
        issue: "Short, lowercase, and readable",
        suggestion: "No change needed.",
        improvement: null,
      },
    ],
  },
  {
    id: "canonical",
    name: "Canonical",
    blurb: "Checks that each page declares one canonical URL and that it matches the preferred address.",
    rows: [
      {
        page: "Home Page",
        path: "https://www.example.com",
        value: "Missing",
        length: "0 tags",
        status: "error",
        issue: "No canonical tag",
        suggestion: "Add one rel=canonical pointing at the preferred homepage URL.",
        improvement: "https://www.example.com/",
      },
      {
        page: "Blog Page",
        path: "https://www.example.com/blog",
        value: "http://www.example.com/blog",
        length: "1 tag",
        status: "warning",
        issue: "Canonical uses http instead of https",
        suggestion: "Point the canonical at the https address.",
        improvement: "https://www.example.com/blog",
      },
      {
        page: "About Page",
        path: "https://www.example.com/about",
        value: "https://www.example.com/about",
        length: "1 tag",
        status: "pass",
        issue: "Canonical matches the page",
        suggestion: "No change needed.",
        improvement: null,
      },
    ],
  },
  {
    id: "schema",
    name: "Schema Markup",
    blurb: "Checks for structured data that matches the page type.",
    rows: [
      {
        page: "Home Page",
        path: "https://www.example.com",
        value: "None",
        length: "0 blocks",
        status: "warning",
        issue: "No Organization or WebSite schema",
        suggestion: "Add Organization schema with the name, url, and logo.",
        improvement: null,
      },
      {
        page: "Blog Post",
        path: "https://www.example.com/blog/fixing-titles",
        value: "BlogPosting missing",
        length: "0 blocks",
        status: "warning",
        issue: "The article has no BlogPosting schema",
        suggestion: "Add headline, datePublished, and author.",
        improvement: null,
      },
      {
        page: "Contact Page",
        path: "https://www.example.com/contact",
        value: "Organization",
        length: "1 block",
        status: "pass",
        issue: "Schema matches the page",
        suggestion: "No change needed.",
        improvement: null,
      },
    ],
  },
];

export const TECHNICAL_TOOLS: SampleTool[] = [
  {
    id: "robots",
    name: "Robots.txt",
    group: "Technical",
    blurb: "Sample rows only. This does not read the live robots.txt yet.",
    rows: [
      {
        page: "robots.txt",
        path: "https://example.com/robots.txt",
        value: "Disallow: /admin",
        length: "1 rule",
        status: "warning",
        issue: "Example: a folder is blocked.",
        suggestion: "Allow the pages you want Google to read.",
        improvement: null,
      },
      {
        page: "Sitemap line",
        path: "https://example.com/robots.txt",
        value: "Sitemap listed",
        length: "1 line",
        status: "pass",
        issue: "Example: a sitemap URL is present.",
        suggestion: "No change needed.",
        improvement: null,
      },
    ],
  },
  {
    id: "sitemap",
    name: "XML Sitemap",
    group: "Technical",
    blurb: "Sample rows only. This does not read the live sitemap yet.",
    rows: [
      {
        page: "sitemap.xml",
        path: "https://example.com/sitemap.xml",
        value: "Missing",
        length: "0 urls",
        status: "error",
        issue: "Example: no sitemap was found.",
        suggestion: "Publish a sitemap of the public pages.",
        improvement: null,
      },
    ],
  },
  {
    id: "https",
    name: "HTTPS",
    group: "Technical",
    blurb: "Sample rows only. The live HTTPS check is inside URL Structure.",
    rows: [
      {
        page: "https://example.com",
        path: "https://example.com",
        value: "https",
        length: "secure",
        status: "pass",
        issue: "Example: the page loads on https.",
        suggestion: "No change needed.",
        improvement: null,
      },
    ],
  },
  {
    id: "indexability",
    name: "Indexability",
    group: "Technical",
    blurb: "Sample rows only. This does not read the live robots meta yet.",
    rows: [
      {
        page: "noindex",
        path: "https://example.com/draft",
        value: "noindex",
        length: "1 tag",
        status: "warning",
        issue: "Example: a page asks not to be indexed.",
        suggestion: "Remove noindex on pages that should rank.",
        improvement: null,
      },
    ],
  },
  {
    id: "core-web-vitals",
    name: "Core Web Vitals",
    group: "Technical",
    blurb: "Sample rows only. biziol does not measure Core Web Vitals yet.",
    rows: [
      {
        page: "LCP",
        path: "https://example.com",
        value: "Not measured",
        length: "—",
        status: "warning",
        issue: "Example: page speed is not scored yet.",
        suggestion: "This row is a preview until a live speed check is added.",
        improvement: null,
      },
    ],
  },
];

export function sampleCounts(rows: SampleRow[]) {
  return {
    errors: rows.filter((row) => row.status === "error").length,
    warnings: rows.filter((row) => row.status === "warning").length,
    passed: rows.filter((row) => row.status === "pass").length,
  };
}
