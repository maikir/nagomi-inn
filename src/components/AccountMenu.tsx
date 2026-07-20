"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Nav account area: "Sign in" link, or a small chip with a sign-out menu.
 *  Renders nothing in localStorage demo mode. */
export function AccountMenu() {
  const { t } = useLang();
  const { enabled, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!enabled) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-xs tracking-[0.2em] text-paper-dim transition-colors hover:text-paper"
      >
        {t.auth.signIn}
      </Link>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={t.auth.account}
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full border border-copper/60 text-xs text-copper-bright transition-colors hover:bg-copper hover:text-sumi-950"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 border border-paper/15 bg-sumi-950/95 py-2 shadow-xl backdrop-blur-md">
          <p className="truncate border-b border-paper/10 px-4 pb-2 pt-1 text-xs text-paper-faint">{user.email}</p>
          <Link
            href="/reservations"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-paper-dim transition-colors hover:text-paper"
          >
            {t.nav.myReservations}
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-paper-dim transition-colors hover:text-copper-bright"
          >
            {t.auth.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
