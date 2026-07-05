"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

export function Access() {
  const { t } = useLang();

  return (
    <section id="access" className="border-t border-paper/10 py-24 md:py-36">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative order-2 min-h-[360px] overflow-hidden lg:order-1">
          <Image
            src="/images/annex-hall-view.jpg"
            alt="Rice paddies seen from the upstairs hall windows"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </Reveal>

        <div className="order-1 flex flex-col justify-center lg:order-2">
          <Reveal>
            <p className="text-[11px] tracking-[0.35em] text-copper-bright">{t.access.kicker.toUpperCase()}</p>
            <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">{t.access.heading}</h2>
            <p className="mt-8 leading-loose text-paper-dim">{t.access.body}</p>
          </Reveal>
          <Reveal delay={150}>
            <dl className="mt-10 divide-y divide-paper/10 border-y border-paper/10">
              {t.access.rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[minmax(120px,1fr)_2fr] gap-4 py-4">
                  <dt className="text-xs tracking-[0.15em] text-paper-faint">{label}</dt>
                  <dd className="text-sm text-paper-dim">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
