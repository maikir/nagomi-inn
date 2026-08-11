"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { site } from "@/config/site";

export function Footer() {
  const { t, lang } = useLang();

  return (
    <footer className="border-t border-paper/10 bg-sumi-950">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center border border-paper/40 font-display text-xl">
                {site.kanji}
              </span>
              <div className="leading-none">
                <p className="font-display text-xl tracking-[0.3em]">{site.name}</p>
                <p className="mt-1.5 text-[10px] tracking-[0.25em] text-paper-dim">{site.taglineLockup}</p>
              </div>
            </div>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-paper-dim">{t.footer.blurb}</p>
            <p className="mt-4 text-xs tracking-wider text-paper-faint">
              {lang === "ja" ? site.location.ja : site.location.en} ・{" "}
              {lang === "ja" ? site.location.airportNoteJa : site.location.airportNoteEn}
            </p>
          </div>

          <div>
            <h3 className="text-xs tracking-[0.3em] text-paper-faint">{t.footer.explore}</h3>
            <ul className="mt-5 space-y-3 text-sm text-paper-dim">
              <li><Link href="/#stay" className="transition-colors hover:text-paper">{t.nav.stay}</Link></li>
              <li><Link href="/#sauna" className="transition-colors hover:text-paper">{t.nav.sauna}</Link></li>
              <li><Link href="/#gallery" className="transition-colors hover:text-paper">{t.nav.gallery}</Link></li>
              <li><Link href="/#access" className="transition-colors hover:text-paper">{t.nav.access}</Link></li>
              <li><Link href="/reserve" className="transition-colors hover:text-paper">{t.nav.reserve}</Link></li>
              <li><Link href="/reservations" className="transition-colors hover:text-paper">{t.nav.myReservations}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs tracking-[0.3em] text-paper-faint">{t.footer.contact}</h3>
            <ul className="mt-5 space-y-3 text-sm text-paper-dim">
              <li>
                <a href={`mailto:${site.contact.email}`} className="transition-colors hover:text-paper">
                  {site.contact.email}
                </a>
              </li>
              <li>
                <a href={`tel:${site.contact.phone.replace(/[^+\d]/g, "")}`} className="transition-colors hover:text-paper">
                  {site.contact.phone}
                </a>
              </li>
              <li>
                <a
                  href={`https://instagram.com/${site.contact.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-paper"
                >
                  @{site.contact.instagram}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-paper/10 pt-6 text-xs tracking-wider text-paper-faint">
          {t.footer.legal.replace("{year}", String(new Date().getFullYear()))}
        </div>
      </div>
    </footer>
  );
}
