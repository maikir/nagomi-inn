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
      <svg className={styles.outline} viewBox="0 0 240 80" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path className={styles.stroke} pathLength="1" vectorEffect="non-scaling-stroke" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          d="M 83 19 C 128 16, 198 17, 222 21 C 236 23, 237 37, 234 57 C 232 71, 218 73, 195 72 C 146 76, 74 72, 25 73 C 8 73, 4 64, 5 46 C 4 28, 9 22, 25 22 L 49 21 Q 56 13, 63 5 Q 65 16, 73 20 L 83 19" />
      </svg>
      <span className={styles.caption}>{children}</span>
    </span>
  );
}
