"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The hero film layer. Two portrait clips of the house:
 *  - Desktop: played side by side as twin vertical panels (diptych).
 *  - Mobile: full-bleed (portrait suits the screen), one after the other
 *    with a crossfade.
 * The hero photo behind this layer doubles as the loading poster, so the
 * videos simply fade in once they begin playing.
 *
 * Playback resilience: iOS blocks autoplay in Low Power Mode / with
 * "Auto-Play Video Previews" off, and play() rejects silently. We re-attempt
 * on the first touch/scroll/click (gesture-initiated playback is always
 * allowed) and whenever a video buffers enough to play. Videos pause while
 * offscreen and never start for visitors who prefer reduced motion.
 */

const FILMS = [
  { src: "/videos/nagomi-film-1.mp4", poster: "/images/kitchen-island-dark.jpg" },
  { src: "/videos/nagomi-film-2.mp4", poster: "/images/dining-vertical.jpg" },
];

export function HeroVideos() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const inViewRef = useRef(true);
  const mobileActiveRef = useRef(0);
  const [layout, setLayout] = useState<"desktop" | "mobile" | null>(null);
  const [visible, setVisible] = useState([false, false]);
  const [mobileActive, setMobileActive] = useState(0);

  // Pick a layout once, after mount (the photo behind covers first paint).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLayout(window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile");
  }, []);

  /** Single source of truth: play/pause every video per current state. */
  const syncPlayback = useCallback(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      const isDesktop = v.dataset.layout === "desktop";
      const shouldPlay = inViewRef.current && (isDesktop || i === mobileActiveRef.current);
      if (shouldPlay && v.paused) v.play().catch(() => {});
      else if (!shouldPlay && !v.paused) v.pause();
    });
  }, []);

  // Pause offscreen / resume in view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !layout) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        syncPlayback();
      },
      { threshold: 0.1 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout, syncPlayback]);

  // Autoplay-block recovery: any first interaction re-kicks playback.
  useEffect(() => {
    if (!layout) return;
    const retry = () => syncPlayback();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("touchstart", retry, opts);
    window.addEventListener("click", retry, opts);
    window.addEventListener("scroll", retry, opts);
    return () => {
      window.removeEventListener("touchstart", retry);
      window.removeEventListener("click", retry);
      window.removeEventListener("scroll", retry);
    };
  }, [layout, syncPlayback]);

  function handleEnded(i: number) {
    if (layout !== "mobile") return;
    const next = (i + 1) % FILMS.length;
    const v = videoRefs.current[next];
    if (v) v.currentTime = 0;
    mobileActiveRef.current = next;
    setMobileActive(next);
    syncPlayback();
  }

  const markVisible = (i: number) =>
    setVisible((v) => v.map((x, j) => (j === i ? true : x)) as typeof v);

  if (!layout) return null;

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
      {layout === "desktop" ? (
        /* Diptych: two vertical panels with a theme-colored hairline seam
           (an opaque divider — the backdrop photo must not peek through) */
        <div className="flex h-full w-full">
          {FILMS.map((film, i) => (
            <div
              key={film.src}
              className={`relative h-full w-1/2 overflow-hidden ${i > 0 ? "border-l border-sumi-950" : ""}`}
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                  if (el) el.muted = true; // belt & braces for autoplay policies
                }}
                data-layout="desktop"
                src={film.src}
                poster={film.poster}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                onCanPlay={syncPlayback}
                onPlaying={() => markVisible(i)}
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
                if (el) el.muted = true; // belt & braces for autoplay policies
              }}
              data-layout="mobile"
              src={film.src}
              poster={film.poster}
              muted
              playsInline
              autoPlay={i === 0}
              preload={i === 0 ? "auto" : "metadata"}
              onCanPlay={syncPlayback}
              onEnded={() => handleEnded(i)}
              onPlaying={() => markVisible(i)}
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
