"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Reveal } from "@/components/Reveal";

type Category = "spaces" | "sauna" | "details";

type Photo = { src: string; alt: string; cat: Category; tall?: boolean };

const photos: Photo[] = [
  { src: "/images/exterior-two-buildings.jpg", alt: "The two charred-black houses of Nagomi under a moody sky", cat: "spaces" },
  { src: "/images/gate-noren.jpg", alt: "The timber entrance gate with the 和 noren curtain", cat: "spaces" },
  { src: "/images/sauna-exterior.jpg", alt: "Barrel sauna and cold plunge tubs on the terrace", cat: "sauna" },
  { src: "/images/living-fireplace-wide.jpg", alt: "Living and dining space with wood stove and round table", cat: "spaces" },
  { src: "/images/dining-vertical.jpg", alt: "The dining hall under blackened beams and a paper lantern", cat: "spaces", tall: true },
  { src: "/images/kitchen-island-view.jpg", alt: "Live-edge cedar kitchen island facing the garden", cat: "spaces" },
  { src: "/images/tatami-room-garden.jpg", alt: "Tatami room opening onto the garden", cat: "spaces" },
  { src: "/images/sauna-interior-benches.jpg", alt: "Inside the cedar barrel sauna", cat: "sauna" },
  { src: "/images/lantern-square.jpg", alt: "A wood-framed lantern glowing against a plaster wall", cat: "details", tall: true },
  { src: "/images/bedroom-warm.jpg", alt: "A bedroom in warm lamplight under old beams", cat: "spaces" },
  { src: "/images/tokonoma-display.jpg", alt: "Tokonoma alcoves with hanging scroll and pottery", cat: "details" },
  { src: "/images/terrace-loungers.jpg", alt: "Loungers on the terrace facing the rice fields", cat: "sauna" },
  { src: "/images/lounge-projector-fan.jpg", alt: "The lofted projector lounge in the annex", cat: "spaces", tall: true },
  { src: "/images/craft-vase-ginkgo.jpg", alt: "A crystalline-glazed vase in a dark alcove", cat: "details" },
  { src: "/images/tatami-room-shoji.jpg", alt: "Tatami room with shoji screens and low table", cat: "spaces" },
  { src: "/images/sauna-interior-view.jpg", alt: "View from inside the sauna to the fields", cat: "sauna" },
  { src: "/images/pendants-copper.jpg", alt: "Copper pendant lamps over the kitchen", cat: "details" },
  { src: "/images/exterior-main-house.jpg", alt: "The main house with tiled roof and engawa porch", cat: "spaces" },
  { src: "/images/craft-dishes.jpg", alt: "Shelves of collected Japanese ceramics", cat: "details" },
  { src: "/images/bedroom-blue.jpg", alt: "Twin beds with blue linens under dark beams", cat: "spaces" },
  { src: "/images/fireplace-fire.jpg", alt: "Kindling catching fire in the wood stove", cat: "details" },
  { src: "/images/annex-hall-view.jpg", alt: "The upstairs hall with rice paddy views on three sides", cat: "spaces" },
  { src: "/images/craft-temari-box.jpg", alt: "A lacquered box painted with temari balls", cat: "details" },
  { src: "/images/noren-close.jpg", alt: "The NAGOMI INN MIYAZAKI noren curtain", cat: "details" },
];

const INITIAL_COUNT = 12;

export function Gallery() {
  const { t } = useLang();
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const filtered = photos.filter((p) => filter === "all" || p.cat === filter);
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);

  // Lightbox keyboard controls
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % filtered.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, filtered.length]);

  const filters: { key: "all" | Category; label: string }[] = [
    { key: "all", label: t.gallery.filterAll },
    { key: "spaces", label: t.gallery.filterSpaces },
    { key: "sauna", label: t.gallery.filterSauna },
    { key: "details", label: t.gallery.filterDetails },
  ];

  return (
    <section id="gallery" className="border-t border-paper/10 bg-sumi-900 py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="text-[11px] tracking-[0.35em] text-copper-bright">{t.gallery.kicker.toUpperCase()}</p>
            <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">{t.gallery.heading}</h2>
          </div>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setExpanded(false);
                }}
                className={`border px-4 py-2 text-xs tracking-[0.15em] transition-all ${
                  filter === f.key
                    ? "border-copper text-copper-bright"
                    : "border-paper/20 text-paper-faint hover:border-paper/40 hover:text-paper-dim"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Masonry via CSS columns */}
        <div className="mt-14 columns-2 gap-3 md:columns-3 lg:columns-4 [&>*]:mb-3">
          {visible.map((p, i) => (
            <button
              key={p.src}
              onClick={() => setLightbox(filtered.indexOf(p))}
              className="group relative block w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
              aria-label={p.alt}
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={800}
                height={p.tall ? 1150 : 560}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="h-auto w-full object-cover transition-all duration-700 group-hover:scale-[1.03] group-hover:brightness-110"
                loading={i < 4 ? undefined : "lazy"}
              />
            </button>
          ))}
        </div>

        {!expanded && filtered.length > INITIAL_COUNT && (
          <div className="mt-12 text-center">
            <button
              onClick={() => setExpanded(true)}
              className="border border-paper/30 px-8 py-4 text-xs tracking-[0.25em] text-paper transition-all hover:border-copper hover:text-copper-bright"
            >
              {t.gallery.viewMore.toUpperCase()}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-sumi-950/95 p-4 backdrop-blur-sm md:p-10"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute right-5 top-5 z-10 p-3 text-xs tracking-[0.25em] text-paper-dim transition-colors hover:text-paper"
            onClick={() => setLightbox(null)}
          >
            {t.gallery.close.toUpperCase()} ✕
          </button>
          <button
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-4 text-2xl text-paper-dim transition-colors hover:text-paper md:left-6"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((lightbox - 1 + filtered.length) % filtered.length);
            }}
            aria-label="Previous photo"
          >
            ←
          </button>
          <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={filtered[lightbox].src}
              alt={filtered[lightbox].alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
          <button
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-4 text-2xl text-paper-dim transition-colors hover:text-paper md:right-6"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((lightbox + 1) % filtered.length);
            }}
            aria-label="Next photo"
          >
            →
          </button>
        </div>
      )}
    </section>
  );
}
