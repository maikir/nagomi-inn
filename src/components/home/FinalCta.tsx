"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

export function FinalCta() {
  const { t } = useLang();

  return (
    <section className="relative overflow-hidden">
      <div className="relative flex min-h-[70svh] items-center justify-center">
        <Image
          src="/images/kitchen-island-view.jpg"
          alt="The kitchen island looking out to the garden at dusk"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="cta-scrim absolute inset-0" />
        <Reveal className="relative z-10 mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-4xl leading-tight md:text-6xl">
            {t.cta.heading1}
            <br />
            {t.cta.heading2}
          </h2>
          <p className="mt-6 text-paper-dim md:text-lg">{t.cta.body}</p>
          <Link
            href="/reserve"
            className="mt-12 inline-block border border-copper bg-copper/10 px-10 py-5 text-xs tracking-[0.25em] text-copper-bright backdrop-blur-sm transition-all hover:bg-copper hover:text-sumi-950 md:text-sm"
          >
            {t.cta.button.toUpperCase()}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
