"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

export function Sauna() {
  const { t } = useLang();

  const points = [t.sauna.point1, t.sauna.point2, t.sauna.point3];

  return (
    <section id="sauna" className="relative overflow-hidden">
      {/* Full-bleed hero image of the sauna */}
      <div className="relative h-[70svh] min-h-[420px]">
        <Image
          src="/images/sauna-exterior.jpg"
          alt="The cedar barrel sauna and galvanized cold-plunge tubs beside the black house"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="photo-scrim absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-sumi-950/30 via-transparent to-sumi-950" />
        <div className="absolute inset-x-0 bottom-10 mx-auto max-w-7xl px-5 md:px-8">
          <Reveal>
            <p className="text-[11px] tracking-[0.35em] text-copper-bright">{t.sauna.kicker}</p>
            <h2 className="mt-4 font-display text-5xl leading-[1.05] md:text-7xl">
              {t.sauna.heading1}
              <br />
              <span className="text-paper-dim">{t.sauna.heading2}</span>
            </h2>
          </Reveal>
        </div>
      </div>

      {/* Detail band */}
      <div className="bg-sumi-950 pb-24 pt-14 md:pb-36">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <Reveal>
            <p className="max-w-xl leading-loose text-paper-dim md:text-lg">{t.sauna.body}</p>
            <ul className="mt-10 space-y-4">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-4 text-sm tracking-wide text-paper">
                  <span className="h-px w-8 bg-copper" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href="/reserve"
              className="mt-12 inline-block border border-paper/30 px-8 py-4 text-xs tracking-[0.25em] text-paper transition-all hover:border-copper hover:text-copper-bright"
            >
              {t.hero.cta.toUpperCase()}
            </Link>
          </Reveal>

          <div className="grid grid-cols-2 gap-3">
            <Reveal delay={100} className="relative aspect-[3/4] overflow-hidden">
              <Image
                src="/images/sauna-interior-view.jpg"
                alt="Inside the barrel sauna, looking out at the rice fields"
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </Reveal>
            <Reveal delay={220} className="relative mt-10 aspect-[3/4] overflow-hidden">
              <Image
                src="/images/sauna-barrel.jpg"
                alt="The cedar barrel sauna beside the charred-black wall"
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
