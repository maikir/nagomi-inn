"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nagomi.theme";
type Theme = "dark" | "light";

/**
 * Insider design-pattern switch: flips the whole site between the charred
 * "sumi" look (default) and the bright "washi" variant. Deliberately quiet —
 * a small ◐ mark in the nav corner.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // The inline script in layout.tsx applies the attribute pre-paint;
    // here we just sync component state with it.
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to bright design" : "Switch to dark design"}
      title={theme === "dark" ? "Bright design" : "Dark design"}
      className="grid h-8 w-8 place-items-center rounded-full border border-paper/20 text-[13px] leading-none text-paper-faint transition-colors hover:border-copper hover:text-copper-bright"
    >
      {theme === "dark" ? "◐" : "◑"}
    </button>
  );
}
