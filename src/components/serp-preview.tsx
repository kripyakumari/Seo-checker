type SerpPreviewProps = {
  title: string;
  cut: number;
  description: string | null;
  finalUrl: string;
  label: string;
  limit: number;
  frame: string;
};

export function SerpPreview({
  title,
  cut,
  description,
  finalUrl,
  label,
  limit,
  frame,
}: SerpPreviewProps) {
  const visible = title.slice(0, cut);
  const hidden = title.slice(cut);
  const { host, crumb, initial } = displayUrl(finalUrl);
  const snippet = description?.trim() || "No meta description on this page.";

  return (
    <figure className={frame}>
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted">{label}</span>
        <span className="text-xs text-muted">Cut at {limit}px</span>
      </figcaption>
      <div className="rounded-2xl border border-[#dadce0] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1f3f4] text-xs font-semibold uppercase text-[#202124]">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-[#202124]">{host}</span>
            <span className="block truncate text-xs text-[#4d5156]">{crumb}</span>
          </span>
        </div>
        <p
          className="mt-2 text-[20px] leading-[1.3] text-[#1a0dab]"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {title ? (
            <>
              {visible}
              {hidden ? (
                <mark className="rounded-sm bg-[#f6d0c6] px-0.5 text-[#1a0dab]/75">{hidden}</mark>
              ) : null}
            </>
          ) : (
            <span className="text-[#80868b]">Empty title</span>
          )}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#4d5156]">{snippet}</p>
      </div>
      <figcaption className="mt-2 text-xs leading-5 text-muted">
        {hidden
          ? "The marked words sit past the cut-off."
          : "The full title fits inside this cut-off."}
      </figcaption>
    </figure>
  );
}

function displayUrl(finalUrl: string) {
  try {
    const url = new URL(finalUrl);
    const host = url.hostname.replace(/^www\./, "");
    const path = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
    return {
      host,
      crumb: `${host}${path}`,
      initial: host.slice(0, 1) || "?",
    };
  } catch {
    return { host: finalUrl, crumb: finalUrl, initial: "?" };
  }
}
