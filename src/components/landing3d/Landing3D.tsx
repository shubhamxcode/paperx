"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SECTION_VH } from "./story";

// three.js only runs in the browser.
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#05080d]" />,
});

/* ---------------------------------- Nav ---------------------------------- */

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { status } = useSession();
  const accountLink =
    status === "authenticated"
      ? { href: "/dashboard", label: "Dashboard" }
      : { href: "/login", label: "Login" };

  return (
    <div className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Image
            src="/Logo.png"
            alt="PaperX Logo"
            width={30}
            height={30}
            className="rounded-full object-contain"
          />
          <span className="text-lg font-extrabold tracking-tight text-white [font-family:var(--font-archivo)]">
            PaperX
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#story"
            className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300 no-underline transition-colors hover:text-emerald-300"
          >
            The Story
          </Link>
          <Link
            href="#features"
            className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300 no-underline transition-colors hover:text-emerald-300"
          >
            Why PaperX
          </Link>
          <Link
            href={accountLink.href}
            className="rounded-full bg-emerald-400 px-5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#04120c] no-underline transition-all hover:bg-emerald-300 hover:shadow-[0_0_24px_rgba(52,211,153,0.5)]"
          >
            {accountLink.label}
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          className="text-white md:hidden"
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          )}
        </button>
      </nav>

      {menuOpen && (
        <div className="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-md md:hidden">
          {[{ href: "#story", label: "The Story" }, { href: "#features", label: "Why PaperX" }, accountLink].map(
            ({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-widest text-slate-200 no-underline hover:bg-white/5 hover:text-emerald-300"
              >
                {label}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Chapters ------------------------------- */

type Align = "left" | "right" | "center";

function Chapter({
  vh,
  align,
  id,
  children,
}: {
  vh: number;
  align: Align;
  id?: string;
  children: React.ReactNode;
}) {
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const text = align === "center" ? "text-center items-center" : "";
  return (
    <section id={id} style={{ minHeight: `${vh}vh` }} className="relative flex items-center px-6">
      <div className={`mx-auto flex w-full max-w-6xl ${justify}`}>
        <div data-chapter-text className={`flex max-w-xl flex-col ${text}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

function GlassCard({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-[0_0_50px_rgba(52,211,153,0.12)]">
      <p className="mb-6 text-xs font-bold tracking-[0.3em] text-emerald-400/80">{index}</p>
      <h3 className="mb-3 text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function Landing3D() {
  const scrollRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = max > 0 ? window.scrollY / max : 0;
    };
    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    onScroll();

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // Story text: scrub in, hold, scrub out — tied to each chapter's scroll range.
      gsap.utils.toArray<HTMLElement>("[data-chapter-text]").forEach((el) => {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: el.closest("section"),
              start: "top 80%",
              end: "bottom 20%",
              scrub: 0.5,
            },
          })
          .fromTo(el, { autoAlpha: 0, y: 90 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" })
          .to(el, { autoAlpha: 1, duration: 0.3 })
          .to(el, { autoAlpha: 0, y: -90, duration: 0.35, ease: "power2.in" });
      });
      // Final section: reveal once, stay.
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 70 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" },
          }
        );
      });
    }, rootRef);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      ctx.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative min-h-screen bg-[#05080d] text-slate-100">
      {/* 3D world — fixed behind everything, driven by scroll + mouse */}
      <div className="fixed inset-0 z-0">
        <Scene scrollRef={scrollRef} mouseRef={mouseRef} />
      </div>

      <div className="relative z-10">
        <Nav />

        {/* Chapter 0 — meet Arjun */}
        <Chapter vh={SECTION_VH[0]} align="left" id="story">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300">
            A short story about real money
          </p>
          <h1 className="text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            Meet Arjun.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-300">
            First salary in the bank. A shiny trading app. ₹5,00,000 in savings, zero
            experience — and one &quot;guaranteed&quot; tip from YouTube.
          </p>
          <p className="mt-8 animate-bounce text-[10px] font-bold uppercase tracking-[0.4em] text-slate-500">
            Scroll to watch it happen ↓
          </p>
        </Chapter>

        {/* Chapter 1 — the first trade */}
        <Chapter vh={SECTION_VH[1]} align="right">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.35em] text-red-400">
            Trade #1
          </p>
          <h2 className="text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            He goes all-in.
          </h2>
          <p className="mt-5 leading-relaxed text-slate-300">
            No stop-loss. No position sizing. No plan. Just confidence — and a chart he
            doesn&apos;t know how to read yet.
          </p>
        </Chapter>

        {/* Chapter 2 — the spiral */}
        <Chapter vh={SECTION_VH[2]} align="left">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.35em] text-red-400">
            The next six months
          </p>
          <h2 className="text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            Loss. After loss. <span className="text-red-400">After loss.</span>
          </h2>
          <p className="mt-5 leading-relaxed text-slate-300">
            The market doesn&apos;t teach. It charges. Revenge trades, averaging down,
            borrowed conviction — his ₹5,00,000 bleeds out one red candle at a time.
          </p>
        </Chapter>

        {/* Chapter 3 — the stat */}
        <Chapter vh={SECTION_VH[3]} align="center">
          <h2 className="text-white drop-shadow-[0_4px_40px_rgba(0,0,0,1)]">
            <span className="text-red-400">9 out of 10</span> retail traders lose money.
          </h2>
          <p className="mt-5 max-w-lg leading-relaxed text-slate-400">
            That&apos;s SEBI&apos;s own data, not a scare tactic. Arjun paid ₹4,85,000 to
            learn it. You don&apos;t have to.
          </p>
        </Chapter>

        {/* Chapter 4 — the turn */}
        <Chapter vh={SECTION_VH[4]} align="left">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-400">
            There&apos;s a smarter way
          </p>
          <h2 className="text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            Learn the market <span className="text-emerald-300">before it schools you.</span>
          </h2>
          <p className="mt-5 leading-relaxed text-slate-300">
            PaperX drops you into the real, live Indian market with ₹10,00,000 of virtual
            money. Real NSE &amp; BSE prices, real volatility, real lessons — and not one
            real rupee at risk.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-block rounded-full bg-emerald-400 px-8 py-4 text-sm font-bold uppercase tracking-[0.15em] text-[#04120c] no-underline shadow-[0_0_40px_rgba(52,211,153,0.35)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_rgba(52,211,153,0.55)]"
            >
              Start Practicing Free
            </Link>
          </div>
        </Chapter>

        {/* Chapter 5 — features + CTA */}
        <section
          id="features"
          style={{ minHeight: `${SECTION_VH[5]}vh` }}
          className="flex flex-col justify-center px-6 py-24"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div data-reveal>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-400">
                Why PaperX
              </p>
              <h2 className="max-w-2xl text-white">
                Everything real. Except the losses.
              </h2>
            </div>
            <div data-reveal className="mt-12 grid gap-6 md:grid-cols-3">
              <GlassCard index="01" title="Live Market Data">
                22,000+ instruments across NSE &amp; BSE stream in real time. The same
                ticks real traders see — you just can&apos;t get hurt by them.
              </GlassCard>
              <GlassCard index="02" title="₹10 Lakh Virtual Capital">
                Place orders, build a portfolio and watch your P&amp;L move tick by tick.
                Every mistake becomes a lesson instead of a bill.
              </GlassCard>
              <GlassCard index="03" title="Pro-Grade Charts">
                Candlestick charts powered by the same engine used on real trading desks —
                learn to read price action the way professionals do.
              </GlassCard>
            </div>

            <div data-reveal className="mt-28 text-center">
              <h2 className="text-white">Don&apos;t be Arjun.</h2>
              <p className="mx-auto mt-5 max-w-lg leading-relaxed text-slate-300">
                Your first crore of mistakes should be free. Master the market on PaperX,
                then walk into the real one prepared.
              </p>
              <Link
                href="/login"
                className="mt-10 inline-block rounded-full bg-emerald-400 px-10 py-5 text-sm font-bold uppercase tracking-[0.15em] text-[#04120c] no-underline shadow-[0_0_50px_rgba(52,211,153,0.4)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_80px_rgba(52,211,153,0.6)]"
              >
                Create Free Account
              </Link>
            </div>
          </div>

          <footer className="mt-auto pt-24">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
              <p className="text-xs text-slate-500">
                © 2026 PaperX — Built for learning. Not investment advice.
              </p>
              <div className="flex gap-6">
                <Link
                  href="#story"
                  className="text-[11px] font-bold uppercase tracking-widest text-slate-500 no-underline hover:text-emerald-300"
                >
                  The Story
                </Link>
                <Link
                  href="#features"
                  className="text-[11px] font-bold uppercase tracking-widest text-slate-500 no-underline hover:text-emerald-300"
                >
                  Why PaperX
                </Link>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
