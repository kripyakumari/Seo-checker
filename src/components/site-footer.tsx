const DEFAULT_SHELL = "mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16 xl:px-20";

export function SiteFooter({ shellClass = DEFAULT_SHELL }: { shellClass?: string }) {
  return (
    <footer className="no-print mt-16 border-t border-line bg-card">
      <div className={`grid gap-8 py-10 lg:grid-cols-[1.4fr_1fr_1fr] ${shellClass}`}>
        <div>
          <p className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white">b</span>
            <span className="text-lg font-semibold tracking-tight">biziol</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Check the on-page and technical SEO of any public webpage. Paste a URL, read the score, and fix the checks that failed.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Product</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            <li>
              <a href="#audit-board" className="hover:text-ink">
                SEO audit
              </a>
            </li>
            <li>
              <a href="#how-to-use" className="hover:text-ink">
                How to check a page
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-ink">
                FAQ
              </a>
            </li>
            <li>
              <a href="#reviews" className="hover:text-ink">
                Reviews
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Checks</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            {["Meta title", "Meta description", "Canonical", "Focus keyword", "Images", "Header tags", "Internal links", "Readability", "URL structure", "Technical samples"].map((name) => (
              <li key={name} className="rounded-full bg-[#f4f7fb] px-2.5 py-1">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className={`flex flex-col gap-2 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between ${shellClass}`}>
          <p>© 2026 biziol. Public pages only.</p>
          <p>Meta Title, Meta Description, Canonical, Focus Keyword, Image Optimization, Header Tags, Internal Links, Readability, URL Structure, JavaScript SEO, and Hreflang are scored from the live page. Other tools are previews.</p>
        </div>
      </div>
    </footer>
  );
}
