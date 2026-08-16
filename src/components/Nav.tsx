"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { site } from "@/config/site";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountMenu } from "@/components/AccountMenu";
import { LogoMark } from "@/components/LogoMark";

export function Nav() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const onHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // 予約の確認 is no longer a top-level tab — it lives in the account menu
  // (avatar dropdown when signed in; the login button leads there otherwise).
  const links = [
    { href: "/#stay", label: t.nav.stay },
    { href: "/#sauna", label: t.nav.sauna },
    { href: "/#gallery", label: t.nav.gallery },
    { href: "/#access", label: t.nav.access },
  ];

  const solid = scrolled || !onHome || open;

  return (
    <header
      className={`site-nav fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid ? "bg-sumi-950/90 backdrop-blur-md border-b border-paper/10" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-20 md:px-8">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark size="sm" />
          {/* Text block centered on the mark; -mt cancels the display font's
              ascender dead-space so the visual gap above NAGOMI matches the
              gap below the tagline. */}
          <span className="flex flex-col justify-center gap-1.5">
            <span className="-mt-0.5 font-display text-lg leading-none tracking-[0.3em]">{site.name}</span>
            <span className="text-[10px] leading-none tracking-[0.25em] text-paper-dim">{site.taglineLockup}</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-xs tracking-[0.2em] text-paper-dim transition-colors hover:text-paper"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/reserve"
            className="border border-copper px-5 py-2.5 text-xs tracking-[0.2em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
          >
            {t.nav.reserve}
          </Link>
          <LangToggle lang={lang} setLang={setLang} />
          <ThemeToggle />
          <AccountMenu />
        </nav>

        {/* Mobile: language + theme + account + menu button */}
        <div className="flex items-center gap-4 lg:hidden">
          <LangToggle lang={lang} setLang={setLang} />
          <ThemeToggle />
          <AccountMenu />
          <button
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex h-9 w-9 flex-col items-center justify-center gap-1.5"
          >
            <span className={`h-px w-6 bg-paper transition-transform ${open ? "translate-y-[3.5px] rotate-45" : ""}`} />
            <span className={`h-px w-6 bg-paper transition-transform ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-[max-height] duration-500 lg:hidden ${open ? "max-h-96" : "max-h-0"}`}
      >
        <nav className="flex flex-col gap-1 border-t border-paper/10 bg-sumi-950/95 px-5 py-4 backdrop-blur-md">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-3 text-sm tracking-[0.2em] text-paper-dim transition-colors hover:text-paper"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/reserve"
            onClick={() => setOpen(false)}
            className="mt-2 border border-copper px-5 py-3 text-center text-sm tracking-[0.2em] text-copper-bright"
          >
            {t.nav.reserve}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function LangToggle({ lang, setLang }: { lang: "en" | "ja"; setLang: (l: "en" | "ja") => void }) {
  return (
    <div className="flex items-center gap-1 text-[11px] tracking-widest" role="group" aria-label="Language">
      <button
        onClick={() => setLang("en")}
        className={`px-1.5 py-1 transition-colors ${lang === "en" ? "text-copper-bright" : "text-paper-faint hover:text-paper-dim"}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <span className="text-paper-faint">/</span>
      <button
        onClick={() => setLang("ja")}
        className={`px-1.5 py-1 transition-colors ${lang === "ja" ? "text-copper-bright" : "text-paper-faint hover:text-paper-dim"}`}
        aria-pressed={lang === "ja"}
      >
        日本語
      </button>
    </div>
  );
}
