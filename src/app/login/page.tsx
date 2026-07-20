"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { site } from "@/config/site";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { t } = useLang();
  const { enabled, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in → continue on.
  if (user) {
    router.replace(next);
    return null;
  }

  async function withOAuth(provider: "google" | "apple") {
    const supabase = getSupabase();
    if (!supabase) return;
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + next },
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + next },
        });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (data.session) router.replace(next);
        else setNotice(t.auth.checkEmail);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/invalid login credentials/i.test(msg)) setError(t.auth.errorInvalid);
      else if (/password/i.test(msg) && /6|short|weak/i.test(msg)) setError(t.auth.errorWeakPassword);
      else setError(t.auth.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-5 pb-24 pt-28 md:px-0">
      <p className="text-center font-display text-5xl text-copper-bright">{site.kanji}</p>
      <h1 className="mt-6 text-center font-display text-3xl md:text-4xl">{t.auth.title}</h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-paper-dim">{t.auth.subtitle}</p>

      {!enabled ? (
        <p className="mt-10 border border-paper/15 bg-sumi-900 px-6 py-5 text-center text-sm text-paper-faint">
          {t.auth.notConfigured}
        </p>
      ) : (
        <div className="mt-10">
          {/* OAuth */}
          <div className="space-y-3">
            <button
              onClick={() => withOAuth("google")}
              className="flex w-full items-center justify-center gap-3 border border-paper/25 bg-sumi-900 px-6 py-3.5 text-sm tracking-wide text-paper transition-colors hover:border-paper/50"
            >
              <GoogleMark />
              {t.auth.google}
            </button>
            <button
              onClick={() => withOAuth("apple")}
              className="flex w-full items-center justify-center gap-3 border border-paper/25 bg-sumi-900 px-6 py-3.5 text-sm tracking-wide text-paper transition-colors hover:border-paper/50"
            >
              <AppleMark />
              {t.auth.apple}
            </button>
          </div>

          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-paper/15" />
            <span className="text-[11px] tracking-[0.25em] text-paper-faint">{t.auth.or.toUpperCase()}</span>
            <span className="h-px flex-1 bg-paper/15" />
          </div>

          {/* Email + password */}
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-xs tracking-[0.2em] text-paper-faint">
              {t.auth.email.toUpperCase()}
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2.5 w-full border border-paper/20 bg-sumi-900 px-4 py-3 text-sm tracking-normal text-paper focus:border-copper focus:outline-none"
              />
            </label>
            <label className="block text-xs tracking-[0.2em] text-paper-faint">
              {t.auth.password.toUpperCase()}
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2.5 w-full border border-paper/20 bg-sumi-900 px-4 py-3 text-sm tracking-normal text-paper focus:border-copper focus:outline-none"
              />
            </label>

            {error && (
              <p className="border border-copper/60 bg-copper/10 px-4 py-3 text-sm text-copper-bright" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="border border-moss/60 bg-moss/10 px-4 py-3 text-sm text-paper" role="status">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full border border-copper bg-copper/10 px-6 py-3.5 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950 disabled:opacity-50"
            >
              {(mode === "signin" ? t.auth.signIn : t.auth.signUp).toUpperCase()}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-paper-faint">
            {mode === "signin" ? t.auth.noAccount : t.auth.haveAccount}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="text-copper-bright underline-offset-4 hover:underline"
            >
              {mode === "signin" ? t.auth.signUp : t.auth.signIn}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

/** Only allow same-site relative paths as the post-login destination. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1l-3.9 3C3.2 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.1 14.3c-.3-.8-.4-1.5-.4-2.3s.2-1.6.4-2.3l-4-3C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8L20.1 3C18 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l4 3c.9-3 3.6-5 6.8-5z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="fill-current">
      <path d="M16.7 12.9c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-4zM14.4 5.2c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3z" />
    </svg>
  );
}
