"use client";

import { useEffect, useRef, useState } from "react";

const DEMO_URL = "yourbrand.com/blog/post";
const DEMO_ITEMS = [
  { name: "Title tag", status: "pass" as const },
  { name: "Meta description", status: "warn" as const },
  { name: "Headings", status: "pass" as const },
  { name: "Image alt text", status: "warn" as const },
  { name: "Internal links", status: "pass" as const },
  { name: "Canonical tag", status: "pass" as const },
  { name: "Schema markup", status: "warn" as const },
  { name: "Core Web Vitals", status: "pass" as const },
];

const CYCLE = 9000;
const TYPE_END = 600;
const SCAN_START = 700;
const SCAN_END = 7400;
const RING = 314.2;

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

type DemoFrame = {
  opacity: number;
  typed: string;
  scanning: boolean;
  percent: number;
  shown: number;
  showScore: boolean;
  scoreRatio: number;
};

function frameAt(t: number): DemoFrame {
  const opacity = t < 300 ? t / 300 : t >= CYCLE - 400 ? (CYCLE - t) / 400 : 1;
  const typedLen = Math.round(clamp01(t / TYPE_END) * DEMO_URL.length);
  const scanning = t < SCAN_END;
  const rawPct = clamp01((t - SCAN_START) / (SCAN_END - SCAN_START));
  let shown = 0;
  DEMO_ITEMS.forEach((_, i) => {
    const threshold = SCAN_START + ((i + 1) / DEMO_ITEMS.length) * (SCAN_END - SCAN_START);
    if (t >= threshold) shown += 1;
  });
  const showScore = t >= SCAN_END;
  const scoreRatio = showScore ? clamp01((t - SCAN_END) / 1100) : 0;
  return {
    opacity,
    typed: DEMO_URL.slice(0, typedLen),
    scanning,
    percent: Math.round(rawPct * 100),
    shown,
    showScore,
    scoreRatio,
  };
}

export function ScanningDemo() {
  const [frame, setFrame] = useState<DemoFrame>(() => frameAt(0));
  const paused = useRef(false);
  const time = useRef(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      if (last.current == null) last.current = ts;
      const dt = ts - last.current;
      last.current = ts;
      if (!paused.current) time.current = (time.current + dt) % CYCLE;
      setFrame(frameAt(time.current));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const dash = (263.9 * frame.scoreRatio).toFixed(1);
  const score = Math.round(84 * frame.scoreRatio);

  return (
    <div
      className="w-full max-w-[520px] overflow-hidden rounded-[20px] border border-[#dce5fb] bg-white text-ink shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
      style={{ opacity: frame.opacity }}
      aria-hidden="true"
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}
    >
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#cbd5e1]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#cbd5e1]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#cbd5e1]" />
        <span className="ml-2 flex min-w-0 flex-1 items-center rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 font-mono text-[13px] text-[#475569]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" className="mr-1.5 shrink-0" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span>{frame.typed}</span>
          <span className="scan-demo-cursor ml-px inline-block h-[13px] w-px bg-[#334155]" />
        </span>
      </div>

      <div className="relative mx-4 mt-3.5 h-[164px] overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
        <div className="flex flex-col gap-2.5">
          <span className="block h-3.5 w-[62%] rounded bg-[#e2e8f0]" />
          <span className="block h-2.5 w-[85%] rounded bg-[#e9eef5]" />
          <span className="flex gap-2">
            <span className="block h-11 w-11 shrink-0 rounded-lg bg-[#dce5fb]" />
            <span className="flex flex-1 flex-col justify-center gap-1.5">
              <span className="block h-2 w-[92%] rounded bg-[#e9eef5]" />
              <span className="block h-2 w-[78%] rounded bg-[#e9eef5]" />
              <span className="block h-2 w-[86%] rounded bg-[#e9eef5]" />
            </span>
          </span>
          <span className="block h-2.5 w-[70%] rounded bg-[#e9eef5]" />
        </div>
        <span
          className="absolute inset-x-0 top-0 transition-opacity duration-300"
          style={{ opacity: frame.scanning ? 1 : 0 }}
        >
          <span className="scan-demo-beam block h-[46px] border-b-2 border-[#1d4ed8] bg-gradient-to-b from-transparent via-[#1d4ed8]/16 to-[#1d4ed8]/35 shadow-[0_10px_18px_-6px_rgba(29,78,216,0.45)]" />
        </span>
        <span className="absolute top-2.5 right-2.5 rounded-full border border-[#dce5fb] bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-[#1d4ed8]">
          {frame.percent}%
        </span>
      </div>

      <div className="p-4">
        {frame.scanning ? (
          <div>
            {DEMO_ITEMS.slice(0, frame.shown).map((item) => {
              const pass = item.status === "pass";
              return (
                <div key={item.name} className="scan-demo-pop mb-1.5 flex items-center gap-2 text-[13.5px] text-[#334155] last:mb-0">
                  <span
                    className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full ${pass ? "bg-[#16a34a]" : "bg-[#d97706]"}`}
                  >
                    {pass ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 8v5M12 16h.01" />
                      </svg>
                    )}
                  </span>
                  {item.name}
                </div>
              );
            })}
          </div>
        ) : null}

        {frame.showScore ? (
          <div className="scan-demo-pop flex items-center gap-4">
            <svg width="80" height="80" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#15803D"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${RING}`}
                transform="rotate(-90 60 60)"
                className="transition-[stroke-dasharray] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.3,1)]"
              />
              <text x="60" y="68" textAnchor="middle" fontSize="30" fontWeight="800" fill="#0F172A" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                {score}
              </text>
            </svg>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">Example</span>
              <span className="text-xl font-bold">Grade B · Good</span>
              <span className="text-[13px] text-[#475569]">2 errors · 6 can become a problem</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
