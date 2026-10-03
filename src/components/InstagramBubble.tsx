"use client";

import { useEffect, useRef } from "react";
import styles from "./InstagramBubble.module.css";

/** A single pen stroke, drawn once when the desktop QR caption enters view. */
export function InstagramBubble({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.dataset.draw = "visible";
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    el.dataset.draw = "waiting";
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={`${styles.bubble} text-copper-bright`}>
      <svg className={styles.outline} viewBox="0 0 150 68" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path className={styles.stroke} pathLength="1" vectorEffect="non-scaling-stroke" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          d="M 20 43 L 4 49 L 18 31 C 17 13, 21 5, 37 5 C 71 2, 112 4, 133 6 C 145 7, 147 16, 146 34 C 147 53, 143 62, 128 62 C 99 65, 59 62, 35 63 C 23 63, 19 55, 20 43" />
      </svg>
      <span className={styles.caption}>{children}</span>
    </span>
  );
}
