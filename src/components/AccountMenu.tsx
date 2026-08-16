"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Nav account area.
 *  - Signed out → login button (reservations are reached after signing in).
 *  - Signed in  → avatar chip (OAuth profile photo, else initial) with a
 *    dropdown: My reservations / sign out.
 *  - Demo mode (no Supabase) → plain reservations link, since there is no
 *    login concept but the local reservations page still works.
 */
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

  if (!enabled) {
    return (
      <Link
        href="/reservations"
        className="text-xs tracking-[0.2em] text-paper-dim transition-colors hover:text-paper"
      >
        {t.nav.myReservations}
      </Link>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="border border-paper/30 px-4 py-2 text-xs tracking-[0.2em] text-paper-dim transition-all hover:border-copper hover:text-copper-bright"
      >
        {t.auth.signIn}
      </Link>
    );
  }

  const avatarUrl = (user.user_metadata?.avatar_url ?? user.user_metadata?.picture) as string | undefined;
  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={t.auth.account}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-copper/60 text-xs text-copper-bright transition-colors hover:border-copper"
      >
        {avatarUrl ? (
          // Plain <img>: OAuth avatar hosts vary, so next/image domain config
          // isn't practical here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 border border-paper/15 bg-sumi-950/95 py-2 shadow-xl backdrop-blur-md">
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
