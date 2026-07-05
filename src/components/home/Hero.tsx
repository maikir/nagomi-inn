"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { site } from "@/config/site";

export function Hero() {
  const { t } = useLang();

  return (
    <section className="hero-section relative flex min-h-[100svh] items-end overflow-hidden">
      {/* Backdrop */}
      <div className="hero-photo absolute inset-0">
        <Image
          src="/images/dining-dark-view.jpg"
          alt="The dark timber dining hall of Nagomi, looking out over the garden"
          fill
          priority
          sizes="100vw"
          className="animate-kenburns object-cover"
        />
        <div className="photo-scrim absolute inset-0" />
        <div className="hero-grad-y absolute inset-0" />
        <div className="hero-grad-x absolute inset-0" />
      </div>

      {/* Vertical 和 accent */}
      <div className="absolute right-6 top-28 hidden select-none md:block lg:right-14">
        <p className="vertical-text animate-fadeUp font-display text-sm tracking-[0.6em] text-paper/60 [animation-delay:900ms]">
          田舎民泊 、和のこころ
        </p>
      </div>

      {/* Copy */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-24 pt-40 md:px-8 md:pb-32">
        <p className="animate-fadeUp text-[11px] tracking-[0.35em] text-copper-bright md:text-xs">
          {t.hero.kicker.toUpperCase()}
        </p>
        <h1 className="mt-6 animate-fadeUp font-display text-5xl leading-[1.08] tracking-tight [animation-delay:150ms] md:text-7xl lg:text-8xl">
          {t.hero.title1}
          <br />
          <span className="text-paper-dim">{t.hero.title2}</span>
        </h1>
        <p className="mt-8 max-w-xl animate-fadeUp text-sm leading-relaxed text-paper-dim [animation-delay:300ms] md:text-base">
          {t.hero.lede}
        </p>
        <div className="mt-10 flex animate-fadeUp items-center gap-6 [animation-delay:450ms]">
          <Link
            href="/reserve"
            className="border border-copper bg-copper/10 px-8 py-4 text-xs tracking-[0.25em] text-copper-bright backdrop-blur-sm transition-all hover:bg-copper hover:text-sumi-950 md:text-sm"
          >
            {t.hero.cta.toUpperCase()}
          </Link>
          <span className="hidden text-xs tracking-[0.2em] text-paper-faint sm:block">
            {site.name} — {site.location.en.split(",")[0].toUpperCase()}
          </span>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <span className="text-[10px] tracking-[0.3em] text-paper-faint">{t.hero.scroll.toUpperCase()}</span>
        <span className="h-10 w-px animate-pulse bg-gradient-to-b from-paper/60 to-transparent" />
      </div>
    </section>
  );
}
