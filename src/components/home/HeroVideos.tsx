"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero film layer. Two portrait clips of the house:
 *  - Desktop: played side by side as twin vertical panels (diptych).
 *  - Mobile: full-bleed (portrait suits the screen), one after the other
 *    with a crossfade.
 * The hero photo behind this layer doubles as the loading poster, so the
 * videos simply fade in once they begin playing. Playback pauses offscreen
 * and never starts for visitors who prefer reduced motion.
 */

const FILMS = [
  { src: "/videos/nagomi-film-1.mp4", poster: "/images/kitchen-island-dark.jpg" },
  { src: "/videos/nagomi-film-2.mp4", poster: "/images/dining-vertical.jpg" },
];

export function HeroVideos() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [layout, setLayout] = useState<"desktop" | "mobile" | null>(null);
  const [visible, setVisible] = useState([false, false]);
  const [mobileActive, setMobileActive] = useState(0);

  // Pick a layout once, after mount (the photo behind covers first paint).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLayout(window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile");
  }, []);

  // Pause everything offscreen; resume what should play when back.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !layout) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        videoRefs.current.forEach((v, i) => {
          if (!v) return;
          const shouldPlay = layout === "desktop" || i === mobileActive;
          if (entry.isIntersecting && shouldPlay) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.1 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout, mobileActive]);

  function handleEnded(i: number) {
    if (layout !== "mobile") return;
    const next = (i + 1) % FILMS.length;
    const v = videoRefs.current[next];
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    setMobileActive(next);
  }

  if (!layout) return null;

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
      {layout === "desktop" ? (
        /* Diptych: two vertical panels with a hairline seam */
        <div className="flex h-full w-full gap-px">
          {FILMS.map((film, i) => (
            <div key={film.src} className="relative h-full w-1/2 overflow-hidden">
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={film.src}
                poster={film.poster}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                onPlaying={() => setVisible((v) => v.map((x, j) => (j === i ? true : x)) as typeof v)}
                className={`h-full w-full object-cover transition-opacity duration-[1500ms] ${
                  visible[i] ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Mobile: full-bleed portrait, films alternating with a crossfade */
        <div className="relative h-full w-full">
          {FILMS.map((film, i) => (
            <video
              key={film.src}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={film.src}
              poster={film.poster}
              muted
              playsInline
              autoPlay={i === 0}
              preload={i === 0 ? "auto" : "metadata"}
              onEnded={() => handleEnded(i)}
              onPlaying={() => setVisible((v) => v.map((x, j) => (j === i ? true : x)) as typeof v)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                visible[i] && mobileActive === i ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
