"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

export function Spaces() {
  const { t } = useLang();

  const spaces = [
    {
      name: t.spaces.omoyaName,
      desc: t.spaces.omoyaDesc,
      img: "/images/living-lantern-tatami.jpg",
      alt: "The main house living space with paper lantern, kitchen and tatami room",
    },
    {
      name: t.spaces.hanareName,
      desc: t.spaces.hanareDesc,
      img: "/images/lounge-projector.jpg",
      alt: "The annex lounge with a wall-sized projector screen and low sofas",
    },
    {
      name: t.spaces.sotoName,
      desc: t.spaces.sotoDesc,
      img: "/images/terrace-loungers.jpg",
      alt: "The sauna terrace with loungers facing the rice fields and mountains",
    },
  ];

  return (
    <section id="stay" className="border-t border-paper/10 bg-sumi-900 py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-[11px] tracking-[0.35em] text-copper-bright">{t.spaces.kicker.toUpperCase()}</p>
          <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">{t.spaces.heading}</h2>
          <p className="mt-6 leading-relaxed text-paper-dim">{t.spaces.lede}</p>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-10">
          {spaces.map((s, i) => (
            <Reveal key={s.name} delay={i * 130} className="group">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={s.img}
                  alt={s.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-sumi-950/70 via-transparent to-transparent" />
              </div>
              <h3 className="mt-6 font-display text-2xl">{s.name}</h3>
              <p className="mt-3 text-sm leading-loose text-paper-dim">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
