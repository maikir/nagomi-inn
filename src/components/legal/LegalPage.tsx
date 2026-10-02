"use client";

import { Fragment } from "react";
import { PLACEHOLDER, type CommerceRow, type LegalSection } from "@/lib/legal";

// Capturing split: odd-indexed parts are the owner-to-fill markers.
const SPLIT = new RegExp(`(${PLACEHOLDER.source})`);

/** Renders text, highlighting the owner-to-fill "change_here" markers. */
function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(SPLIT).map((part, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <mark key={i} className="bg-copper/20 px-1 text-copper-bright">{part}</mark>
        ),
      )}
    </>
  );
}

export function LegalPage({
  title,
  note,
  effective,
  rows,
  sections,
}: {
  title: string;
  note?: string;
  effective?: string;
  rows?: CommerceRow[];
  sections?: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-28 md:px-8 md:pt-36">
      <p className="text-[11px] tracking-[0.35em] text-copper-bright">田舎民泊 和</p>
      <h1 className="mt-4 font-display text-3xl md:text-4xl">{title}</h1>
      {note && <p className="mt-4 text-sm text-paper-faint">{note}</p>}

      {rows && (
        <dl className="mt-12 divide-y divide-paper/10 border-y border-paper/10">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-2 py-5 md:grid-cols-[200px_1fr] md:gap-8">
              <dt className="text-xs tracking-[0.15em] text-paper-faint">{label}</dt>
              <dd className="text-sm leading-relaxed text-paper"><Marked text={value} /></dd>
            </div>
          ))}
        </dl>
      )}

      {sections && (
        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-xl">{s.heading}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 text-sm leading-relaxed text-paper-dim"><Marked text={p} /></p>
              ))}
              {s.list && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-paper-dim">
                  {s.list.map((item) => (
                    <li key={item}><Marked text={item} /></li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {effective && <p className="mt-12 text-sm text-paper-faint"><Marked text={effective} /></p>}
    </div>
  );
}
