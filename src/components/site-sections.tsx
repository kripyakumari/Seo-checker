"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { FaArrowUpRightFromSquare, FaCheck, FaDownload, FaLink, FaMagnifyingGlass } from "react-icons/fa6";
import { FaExclamation, FaRegFilePdf, FaSearch } from "react-icons/fa";

const REVIEW_KEY = "biziol.reviews.v1";

type Review = {
  id: string;
  label: string;
  stars: number;
  text: string;
  createdAt: string;
};

const STARTER_REVIEWS: Review[] = [
  {
    id: "starter-seo",
    label: "In-house SEO",
    stars: 5,
    text: "We paste one blog URL and see the title length, the pixel cut, and the line to rewrite. That used to be a guess between the writer and the SEO.",
    createdAt: "2026-10-12",
  },
  {
    id: "starter-agency",
    label: "Agency lead",
    stars: 4,
    text: "The live title, image, heading, and internal link checks are the ones we use on a client page. The other tools stay marked as previews, so nobody treats a sample row as the site’s real score.",
    createdAt: "2026-10-08",
  },
  {
    id: "starter-editor",
    label: "Content editor",
    stars: 5,
    text: "The correction sits beside the failed check. I can change the title without turning a score into a writing brief.",
    createdAt: "2026-09-29",
  },
  {
    id: "starter-consultant",
    label: "Freelance consultant",
    stars: 4,
    text: "One public URL at a time is enough before a call. I download the title report and walk through the warnings with the client.",
    createdAt: "2026-09-18",
  },
];

const FAQS = [
  {
    question: "What does biziol check?",
    answer:
      "One public webpage at a time. It looks at on-page and technical signals on that URL: the meta title, the images, the headings, the internal links, how easy the main text is to read, and the URL structure.",
  },
  {
    question: "Which tools are reading my page?",
    answer:
      "Meta Title, Meta Description, Canonical, Focus Keyword, Image Optimization, Header Tags, Internal Links, Readability, and URL Structure fetch the live page and score it. The other on-page tools are previews with sample rows.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. Paste a URL and run the audit. Reports from this browser stay on this device until you clear them.",
  },
  {
    question: "Can I check a blog post, not just the homepage?",
    answer:
      "Yes. Use the exact page URL. The score belongs to that page. A different URL is a different check.",
  },
  {
    question: "Why was a URL rejected?",
    answer:
      "The address has to be a public webpage. Spaces, private networks, localhost, and non-HTML responses stop the check so biziol does not invent a score.",
  },
];

export function SiteSections() {
  return (
    <div className="no-print space-y-14 bg-white pt-12">
      <HowTo />
      <SeeItInAction />
      <Faq />
      <Reviews />
    </div>
  );
}

function HowTo() {
  const steps: {
    title: string;
    body: ReactNode;
    icon: ReactNode;
  }[] = [
    {
      title: "Paste your URL",
      icon: <FaLink className="h-5 w-5" aria-hidden="true" />,
      body: (
        <>
          Drop in any public page and hit <span className="font-semibold text-ink">Run free audit</span> — that&apos;s it. No login needed to try.
        </>
      ),
    },
    {
      title: "We scan the live checks",
      icon: <FaSearch className="h-5 w-5" aria-hidden="true" />,
      body: "Nine live on-page tools score the page. JavaScript SEO compares the raw HTML with the rendered page, and Hreflang opens each language version. The other technical tools stay marked as samples.",
    },
    {
      title: "Get score + PDF",
      icon: <FaRegFilePdf className="h-5 w-5" aria-hidden="true" />,
      body: "See the score with the exact fix next to every failed check — and download a shareable PDF report in one click.",
    },
  ];

  return (
    <section id="how-to-use" className="scroll-mt-24 overflow-hidden rounded-[28px] bg-white px-4 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#dbe7ff] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb] shadow-[0_8px_20px_-16px_rgba(37,99,235,0.55)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" aria-hidden="true" />
          How it works
        </p>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your SEO report in{" "}
          <span className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#0ea5e9] bg-clip-text text-transparent">
            3 easy steps
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted sm:text-base">
          No setup, no sign-up to try. Paste a link and let biziol score the public page.
        </p>
      </div>

      <ol className="relative mt-12 grid gap-8 lg:grid-cols-3 lg:gap-6">
        {steps.map((step, index) => (
          <li key={step.title} className="group relative pt-5">
            <span className="absolute left-1/2 top-0 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1d4ed8] text-xs font-semibold text-white shadow-[0_10px_24px_-10px_rgba(29,78,216,0.9)] transition duration-300 group-hover:scale-110 group-hover:bg-[#2563eb]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="h-full rounded-[24px] border border-[#bfdbfe] bg-white px-6 pb-7 pt-10 text-center shadow-[0_28px_50px_-28px_rgba(37,99,235,0.45)] transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_34px_56px_-24px_rgba(37,99,235,0.55)]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#38bdf8] text-white shadow-[0_16px_30px_-14px_rgba(37,99,235,0.85)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_22px_36px_-12px_rgba(14,165,233,0.7)]">
                {step.icon}
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink transition-colors group-hover:text-[#1d4ed8]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const RING = 314.16;
const DEMO_SCORE = 84;

function SeeItInAction() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [score, setScore] = useState(0);
  const [barsOn, setBarsOn] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spot, setSpot] = useState({ x: 210, y: 140 });
  const reduceMotion = useRef(false);

  const features = [
    {
      title: "Overall score & grade",
      body: "Know exactly where the page stands, at a glance.",
    },
    {
      title: "150+ checks across live tools",
      body: "On-page SEO, JavaScript SEO, and Hreflang are scored live. The other technical tools stay marked as samples.",
    },
    {
      title: "Top fixes ranked first",
      body: "What’s worth fixing now, not a wall of errors to sort through yourself.",
    },
    {
      title: "One-click PDF report",
      body: "Download a shareable PDF with the score, failed checks, and the fix next to each row.",
    },
  ];

  const bars = [
    { label: "On-page", value: 88, tone: "bg-[#16a34a]" },
    { label: "Technical", value: 79, tone: "bg-[#b45309]" },
    { label: "Speed", value: 74, tone: "bg-[#c2410c]" },
    { label: "Schema & social", value: 92, tone: "bg-[#16a34a]" },
  ];

  const tags = [
    { label: "Title tag", ok: true },
    { label: "Meta description", ok: false },
    { label: "Schema markup", ok: true },
    { label: "Core Web Vitals", ok: false },
  ];

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reduceMotion.current = reduce;
    if (reduce) {
      setShown(true);
      setScore(DEMO_SCORE);
      setBarsOn(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shown || reduceMotion.current) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      const eased = 1 - (1 - t) ** 3;
      setScore(Math.round(DEMO_SCORE * eased));
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const bars = window.setTimeout(() => setBarsOn(true), 220);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(bars);
    };
  }, [shown]);

  function moveCard(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setSpot({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (reduceMotion.current) return;
    setTilt({ x: py * -7, y: px * 9 });
  }

  function leaveCard() {
    setHover(false);
    setTilt({ x: 0, y: 0 });
  }

  const dash = ((score / 100) * RING).toFixed(1);
  const scoreLit = focus === 0 || hover;
  const checksLit = focus === 1;
  const fixesLit = focus === 2;
  const pdfLit = focus === 3;

  return (
    <section id="see-it-in-action" ref={sectionRef} className="scroll-mt-24 py-6 sm:py-10">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-3.5 py-1.5 text-xs font-semibold text-[#1d4ed8] transition duration-300 hover:-translate-y-0.5 hover:bg-[#dbe7ff]">
            See it in action
            <FaArrowUpRightFromSquare className="h-3 w-3" aria-hidden="true" />
          </p>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
            A full SEO report{" "}
            <span className="font-display italic font-bold text-[#2563eb]">in under 10 seconds</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:text-base">
            No spreadsheets, no guesswork. One clean scorecard with every issue ranked by how much it matters, and a PDF you can hand straight to a client or developer.
          </p>
          <ul className="mt-8 space-y-2">
            {features.map((item, index) => {
              const active = focus === index;
              return (
                <li
                  key={item.title}
                  onMouseEnter={() => setFocus(index)}
                  onMouseLeave={() => setFocus(null)}
                  className={`flex cursor-default gap-3 rounded-2xl px-2.5 py-2.5 transition duration-300 ${active ? "bg-[#eef4ff] shadow-[0_10px_30px_-22px_rgba(37,99,235,0.9)]" : "hover:bg-[#f8fafc]"}`}
                >
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition duration-300 ${active ? "scale-105 bg-[#2563eb] text-white" : "bg-[#eef4ff] text-[#2563eb]"}`}>
                    <FaCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className={`text-sm font-bold sm:text-base ${active ? "text-[#1d4ed8]" : "text-ink"}`}>{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#hero-check"
              className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,0.9)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#1d4ed8] hover:shadow-[0_16px_30px_-12px_rgba(37,99,235,0.85)]"
            >
              Run your free audit
            </a>
            <p className="text-sm text-muted">No credit card · results in seconds</p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
          <div
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] blur-2xl transition duration-500"
            style={{
              background: "radial-gradient(circle at 72% 18%, rgba(37,99,235,0.22), transparent 52%), radial-gradient(circle at 18% 84%, rgba(22,163,74,0.16), transparent 46%)",
              opacity: hover || focus !== null ? 1 : 0.55,
              transform: hover ? "scale(1.06)" : "scale(1)",
            }}
          />
          <div className="see-float absolute -top-3 right-6 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
            <FaCheck className="h-3 w-3 text-[#86efac]" aria-hidden="true" />
            Scored in 9.4s
          </div>
          <div
            onMouseEnter={() => setHover(true)}
            onMouseMove={moveCard}
            onMouseLeave={leaveCard}
            ref={cardRef}
            className="relative overflow-hidden rounded-[24px] border border-[#e8eef6] bg-white p-5 sm:p-6"
            style={{
              transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${hover ? -10 : 0}px) scale(${hover ? 1.018 : 1})`,
              transition: hover ? "box-shadow 280ms ease, transform 70ms linear" : "box-shadow 420ms ease, transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              boxShadow: hover
                ? "0 36px 70px -28px rgba(27,36,51,0.5), 0 0 0 1px rgba(37,99,235,0.08)"
                : "0 28px 60px -28px rgba(27,36,51,0.45)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: hover ? 1 : 0,
                background: `radial-gradient(380px circle at ${spot.x}px ${spot.y}px, rgba(37,99,235,0.14), transparent 46%)`,
              }}
            />
            <div className="see-sheen pointer-events-none absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />

            <div className="relative flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#2563eb] transition duration-300 ${hover ? "scale-105 bg-[#dbe7ff]" : "bg-[#eef4ff]"}`}>
                <FaMagnifyingGlass className={`h-4 w-4 ${hover ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">SEO Audit Report</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                      <span className="see-live-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#16a34a]" />
                      yourbrand.com/blog/post · just now
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full bg-[#e8f8ef] px-2.5 py-1 text-[11px] font-bold text-[#067647] transition duration-300 ${scoreLit ? "scale-105 shadow-[0_8px_18px_-10px_rgba(22,163,74,0.9)]" : ""}`}>
                    Grade B
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-6 flex items-center gap-5">
              <div className={`relative grid h-[108px] w-[108px] shrink-0 place-items-center rounded-full transition duration-300 ${scoreLit ? "shadow-[0_0_0_8px_rgba(22,163,74,0.08)]" : ""}`}>
                <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${RING}`}
                  />
                </svg>
                <div className="text-center">
                  <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">{score}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">SEO score</p>
                </div>
              </div>
              <div className={`min-w-0 flex-1 space-y-2.5 rounded-2xl p-1.5 transition duration-300 ${scoreLit && focus === 0 ? "bg-[#f0fdf4]" : ""}`}>
                {bars.map((bar, index) => (
                  <div key={bar.label} className="transition duration-300 hover:translate-x-0.5">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-muted">{bar.label}</span>
                      <span className="font-bold text-ink tabular-nums">{barsOn ? bar.value : 0}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#eef2f7]">
                      <div
                        className={`h-full rounded-full ${bar.tone}`}
                        style={{
                          width: barsOn ? `${bar.value}%` : "0%",
                          transition: `width 700ms cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 90}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-2">
              {tags.map((tag, index) => {
                const warn = !tag.ok;
                const lit = checksLit || (fixesLit && warn);
                return (
                  <div
                    key={tag.label}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_24px_-16px_rgba(37,99,235,0.85)] ${lit ? "border-[#bfdbfe] bg-white shadow-[0_10px_22px_-16px_rgba(37,99,235,0.8)]" : "border-[#e8eef6] bg-[#f8fafc]"} ${fixesLit && warn ? "border-[#f3d19c] bg-[#fff7ed]" : ""}`}
                    style={{ transitionDelay: shown ? `${index * 40}ms` : "0ms" }}
                  >
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${tag.ok ? "bg-[#16a34a]" : "bg-[#d97706]"}`}>
                      {tag.ok ? <FaCheck className="h-2.5 w-2.5" aria-hidden="true" /> : <FaExclamation className="h-2.5 w-2.5" aria-hidden="true" />}
                    </span>
                    {tag.label}
                  </div>
                );
              })}
            </div>

            <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <a
                href="#hero-check"
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#1d4ed8] ${pdfLit ? "scale-[1.03] shadow-[0_16px_28px_-12px_rgba(37,99,235,0.9)]" : "shadow-[0_10px_20px_-14px_rgba(37,99,235,0.8)]"}`}
              >
                <FaDownload className="h-3.5 w-3.5" aria-hidden="true" />
                Download PDF report
              </a>
              <a href="#hero-check" className="group text-sm font-semibold text-[#2563eb]">
                View all live checks <span className="inline-block transition duration-300 group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="max-w-2xl">
        <p className="inline-flex items-center rounded-full bg-[#eef4ff] px-3.5 py-1.5 text-xs font-semibold text-[#1d4ed8]">Questions</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Frequently asked questions</h2>
        <p className="mt-3 text-sm leading-6 text-muted sm:text-base">Short answers about what the audit reads, and what it leaves alone.</p>
      </div>
      <div className="mt-8 grid gap-3">
        {FAQS.map((item, index) => {
          const expanded = open === index;
          return (
            <div
              key={item.question}
              className={`overflow-hidden rounded-2xl border bg-white transition duration-300 ${expanded ? "border-[#c7d7fe] shadow-[0_18px_40px_-28px_rgba(37,99,235,0.85)]" : "border-[#e8eef6] hover:-translate-y-0.5 hover:border-[#d5e2fb] hover:shadow-[0_14px_30px_-24px_rgba(27,36,51,0.45)]"}`}
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? -1 : index)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              >
                <span className={`text-sm font-semibold sm:text-[15px] ${expanded ? "text-[#1d4ed8]" : "text-ink"}`}>{item.question}</span>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none transition duration-300 ${expanded ? "rotate-45 bg-[#2563eb] text-white" : "bg-[#eef4ff] text-[#2563eb]"}`}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-5 text-sm leading-7 text-muted sm:px-5">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Reviews() {
  const [reviews, setReviews] = useState<Review[]>(STARTER_REVIEWS);
  const [writing, setWriting] = useState(false);
  const [label, setLabel] = useState("");
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REVIEW_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Review[];
      if (Array.isArray(parsed) && parsed.length > 0) setReviews(parsed);
    } catch {
      setReviews(STARTER_REVIEWS);
    }
  }, []);

  const average = reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length;

  function save(event: FormEvent) {
    event.preventDefault();
    const comment = text.trim();
    if (comment.length < 12) {
      setError("Write a sentence about the check.");
      return;
    }
    const next: Review = {
      id: `local-${Date.now()}`,
      label: label.trim() || "Visitor",
      stars,
      text: comment,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const list = [next, ...reviews].slice(0, 12);
    setReviews(list);
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(list));
    setWriting(false);
    setLabel("");
    setText("");
    setStars(5);
    setError("");
  }

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center rounded-full bg-[#fff7e6] px-3.5 py-1.5 text-xs font-semibold text-[#b45309]">From people who ran a check</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">User reviews</h2>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">Notes on the page audit. A review you write is saved in this browser.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-[#f3e2b3] bg-[#fffaf0] px-4 py-2.5">
            <Stars value={average} />
            <p className="mt-1 text-sm">
              <span className="font-bold text-ink">{average.toFixed(1)} / 5.0</span>
              <span className="ml-2 text-muted">Based on {reviews.length} reviews</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWriting((open) => !open)}
            className="rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,0.9)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
          >
            {writing ? "Close" : "Write a review"}
          </button>
        </div>
      </div>

      {writing ? (
        <form onSubmit={save} className="mt-6 rounded-[24px] border border-[#dbe7ff] bg-white p-5 shadow-[0_20px_40px_-28px_rgba(37,99,235,0.65)]">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-muted">Name, optional</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={40}
                className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    aria-pressed={value <= stars}
                    onClick={() => setStars(value)}
                    className={`text-2xl leading-none transition duration-200 hover:-translate-y-0.5 hover:scale-110 ${value <= stars ? "text-[#f5b400]" : "text-[#d5deea]"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted">Review</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              maxLength={400}
              className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
            />
          </label>
          {error ? <p className="mt-2 text-sm text-clay">{error}</p> : null}
          <button type="submit" className="mt-4 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#1d4ed8]">
            Publish review
          </button>
        </form>
      ) : null}

      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="group relative overflow-hidden rounded-[22px] border border-[#e8eef6] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(27,36,51,0.45)] transition duration-300 hover:-translate-y-1 hover:border-[#c7d7fe] hover:shadow-[0_22px_44px_-24px_rgba(37,99,235,0.55)]"
          >
            <span className="pointer-events-none absolute -top-3 right-4 font-display text-7xl leading-none text-[#eef4ff] transition duration-300 group-hover:text-[#dbe7ff]" aria-hidden="true">
              “
            </span>
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eef4ff] text-sm font-bold text-[#2563eb] transition duration-300 group-hover:scale-105 group-hover:bg-[#2563eb] group-hover:text-white">
                  {review.label.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{review.label}</span>
                  <span className="block text-xs text-muted">{review.createdAt}</span>
                </span>
              </div>
              <Stars value={review.stars} />
            </div>
            <p className="relative mt-4 text-sm leading-7 text-[#334155]">“{review.text}”</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-[#f5b400]" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star}>{star <= Math.round(value) ? "★" : "☆"}</span>
      ))}
    </span>
  );
}
