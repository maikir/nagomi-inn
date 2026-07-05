"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

export function Intro() {
  const { t } = useLang();

  const stats = [
    [t.intro.stat1n, t.intro.stat1],
    [t.intro.stat2n, t.intro.stat2],
    [t.intro.stat3n, t.intro.stat3],
    [t.intro.stat4n, t.intro.stat4],
  ];

  return (
    <section id="about" className="relative overflow-hidden py-24 md:py-36">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-2 lg:gap-20">
        {/* Copy */}
        <div className="flex flex-col justify-center">
          <Reveal>
            <p className="text-[11px] tracking-[0.35em] text-copper-bright">{t.intro.kicker.toUpperCase()}</p>
            <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">{t.intro.heading}</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 leading-loose text-paper-dim">{t.intro.body1}</p>
            <p className="mt-5 leading-loose text-paper-dim">{t.intro.body2}</p>
          </Reveal>
          <Reveal delay={200}>
            <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
              {stats.map(([n, label]) => (
                <div key={label} className="border-l border-paper/15 pl-4">
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-4xl text-paper">{n}</dd>
                  <dd className="mt-2 text-[11px] tracking-[0.15em] text-paper-faint">{label.toUpperCase()}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* Imagery collage */}
        <div className="relative grid grid-cols-12 grid-rows-6 gap-3 min-h-[480px] lg:min-h-[560px]">
          <Reveal className="relative col-span-8 row-span-6 overflow-hidden">
            <Image
              src="/images/entry-genkan.jpg"
              alt="Hand-crafted cedar lattice doors at the entrance"
              fill
              sizes="(min-width: 1024px) 40vw, 60vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </Reveal>
          <Reveal delay={150} className="relative col-span-4 row-span-3 overflow-hidden">
            <Image
              src="/images/nagomi-sign.jpg"
              alt="The carved 和 NAGOMI sign on a cedar post"
              fill
              sizes="20vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </Reveal>
          <Reveal delay={250} className="relative col-span-4 row-span-3 overflow-hidden">
            <Image
              src="/images/switch-brass.jpg"
              alt="A brass toggle light switch on charred wood"
              fill
              sizes="20vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
