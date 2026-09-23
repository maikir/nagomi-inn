"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

export function FinalCta() {
  const { t, lang } = useLang();

  return (
    <section className="over-photo relative overflow-hidden">
      <div className="relative flex min-h-[70svh] items-center justify-center">
        <Image
          src="/images/countryside-rainbow-hires.jpg"
          alt="A rainbow above green rice fields in the Miyazaki countryside"
          fill
          quality={90}
          sizes="max(100vw, 94svh)"
          className="object-cover object-bottom"
        />
        {/* Cinematic dark grade (graded gradient + vignette), not a flat scrim. */}
        <div className="cta-grad absolute inset-0" />
        <Reveal className="relative z-10 mx-auto max-w-3xl px-5 text-center [text-shadow:0_2px_14px_rgba(0,0,0,0.4)]">
          <h2 className={`font-display text-paper-bright ${lang === "en" ? "whitespace-pre-line text-3xl leading-[1.45] md:text-5xl md:leading-[1.45]" : "text-4xl leading-tight md:text-6xl"}`}>
            {t.cta.heading1}
            <br />
            {t.cta.heading2}
          </h2>
          <p className="mt-6 text-paper-bright/90 md:text-lg">{t.cta.body}</p>
          <Link
            href="/reserve"
            className="mt-12 inline-block border border-copper bg-copper/10 px-10 py-5 text-xs tracking-[0.25em] text-copper-bright backdrop-blur-sm [text-shadow:none] transition-all hover:bg-copper hover:text-sumi-950 md:text-sm"
          >
            {t.cta.button.toUpperCase()}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
