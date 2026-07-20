"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLang, fill } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { site, formatYen } from "@/config/site";
import { RangeCalendar } from "@/components/reserve/RangeCalendar";
import {
  getReservationStore,
  nightsBetween,
  formatDate,
  type Reservation,
} from "@/lib/reservations";

type Step = "dates" | "details" | "confirm" | "done";

/** In-progress form state, kept across the sign-in redirect. */
const DRAFT_KEY = "nagomi.reserveDraft";

/** Stripe checkout is used when this build was configured for payments. */
const PAYMENTS_ON = process.env.NEXT_PUBLIC_PAYMENTS === "stripe";

type Draft = {
  step: Step;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

export default function ReservePage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { enabled: authEnabled, user } = useAuth();
  const store = useMemo(() => getReservationStore(), []);

  const [step, setStep] = useState<Step>("dates");
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(4);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);
  // Saving is disabled until restoration has committed — the flag is set in the
  // same batch as the restored values, so a save can never observe pre-restore
  // state (this also survives StrictMode's double effect run in dev).
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    store.bookedDates().then(setBooked).catch(() => {});
  }, [store]);

  // Restore an in-progress draft (e.g. coming back from the sign-in redirect).
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setStep(d.step === "done" ? "dates" : d.step);
        setCheckIn(d.checkIn);
        setCheckOut(d.checkOut);
        setGuests(d.guests);
        setName(d.name);
        setEmail(d.email);
        setPhone(d.phone);
        setNotes(d.notes);
      }
    } catch {}
    setDraftReady(true);
  }, []);

  // Keep the draft current while the visitor fills the form.
  useEffect(() => {
    if (!draftReady || step === "done") return;
    const draft: Draft = { step, checkIn, checkOut, guests, name, email, phone, notes };
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draftReady, step, checkIn, checkOut, guests, name, email, phone, notes]);

  // Signed-in guests get their details prefilled.
  useEffect(() => {
    if (!user) return;
    setEmail((cur) => cur || user.email || "");
    const fullName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
    if (fullName) setName((cur) => cur || fullName);
  }, [user]);

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const p = site.pricing;
  const extraGuests = Math.max(0, guests - p.includedGuests);
  const baseTotal = nights * p.baseNightly;
  const extraTotal = extraGuests * p.perGuestNightly * nights;
  const total = nights > 0 ? baseTotal + extraTotal + p.cleaningFee : 0;

  const nightsLabel = fill(nights === 1 ? t.reserve.nights_one : t.reserve.nights_other, { n: nights });
  const guestsLabel = fill(guests === 1 ? t.reserve.guest_one : t.reserve.guest_other, { n: guests });

  function next() {
    setError(null);
    if (step === "dates") {
      if (!checkIn || !checkOut || nights < p.minNights) return setError(t.reserve.errorDates);
      setStep("details");
    } else if (step === "details") {
      if (!name.trim()) return setError(t.reserve.errorName);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(t.reserve.errorEmail);
      setStep("confirm");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError(null);
    setStep(step === "confirm" ? "details" : "dates");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!checkIn || !checkOut) return;
    // Reserving requires an account when Supabase is connected. The draft is
    // already in sessionStorage, so nothing is lost across the redirect.
    if (authEnabled && !user) {
      router.push("/login?next=/reserve");
      return;
    }

    // Payments mode: the server holds the dates, computes the real price and
    // sends us to Stripe Checkout. The draft survives a cancelled payment.
    if (PAYMENTS_ON && authEnabled) {
      setSubmitting(true);
      setError(null);
      try {
        const session = (await getSupabase()?.auth.getSession())?.data.session;
        if (!session) {
          router.push("/login?next=/reserve");
          return;
        }
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            checkIn,
            checkOut,
            guests,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            notes: notes.trim() || undefined,
            lang,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.ok && json.url) {
          window.location.href = json.url;
          return; // keep `submitting` on while the browser navigates to Stripe
        }
        if (json.error === "UNAVAILABLE") {
          setError(t.reserve.errorUnavailable);
          setBooked(await store.bookedDates());
          setStep("dates");
        } else if (json.error === "AUTH_REQUIRED") {
          router.push("/login?next=/reserve");
        } else {
          setError(t.reserve.payError);
        }
      } catch {
        setError(t.reserve.payError);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const reservation = await store.create({
        checkIn,
        checkOut,
        guests,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        totalYen: total,
      });
      setConfirmed(reservation);
      setStep("done");
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof Error && e.message === "UNAVAILABLE") {
        setError(t.reserve.errorUnavailable);
        setBooked(await store.bookedDates());
        setStep("dates");
      } else if (e instanceof Error && e.message === "AUTH_REQUIRED") {
        router.push("/login?next=/reserve");
      } else {
        setError(String(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: "dates", label: t.reserve.stepDates },
    { key: "details", label: t.reserve.stepDetails },
    { key: "confirm", label: t.reserve.stepConfirm },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-28 md:px-8 md:pt-36">
      {step !== "done" && (
        <>
          <p className="text-[11px] tracking-[0.35em] text-copper-bright">{site.tagline}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl">{t.reserve.title}</h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-paper-dim">{t.reserve.subtitle}</p>

          {/* Step indicator */}
          <ol className="mt-12 flex items-center gap-2 text-[11px] tracking-[0.2em]">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className={`grid h-7 w-7 place-items-center border ${
                    i <= stepIndex ? "border-copper text-copper-bright" : "border-paper/20 text-paper-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={i <= stepIndex ? "text-paper" : "text-paper-faint"}>{s.label.toUpperCase()}</span>
                {i < steps.length - 1 && <span className="mx-2 h-px w-8 bg-paper/20" />}
              </li>
            ))}
          </ol>
        </>
      )}

      {error && (
        <div className="mt-8 border border-copper/60 bg-copper/10 px-5 py-4 text-sm text-copper-bright" role="alert">
          {error}
        </div>
      )}

      {/* ── STEP: DATES + GUESTS ─────────────────────────────────────────── */}
      {step === "dates" && (
        <div className="mt-12 grid gap-14 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="font-display text-2xl">{t.reserve.selectDates}</h2>
            <p className="mt-2 text-sm text-paper-faint">{t.reserve.selectDatesHint}</p>
            <div className="mt-8">
              <RangeCalendar
                checkIn={checkIn}
                checkOut={checkOut}
                booked={booked}
                onChange={(ci, co) => {
                  setCheckIn(ci);
                  setCheckOut(co);
                  setError(null);
                }}
              />
            </div>

            <div className="mt-10 border-t border-paper/10 pt-8">
              <h2 className="font-display text-2xl">{t.reserve.guests}</h2>
              <p className="mt-2 text-sm text-paper-faint">{t.reserve.guestsHint}</p>
              <div className="mt-6 flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="grid h-12 w-12 place-items-center border border-paper/30 text-xl text-paper transition-colors hover:border-copper hover:text-copper-bright"
                  aria-label="Fewer guests"
                >
                  −
                </button>
                <span className="min-w-[90px] text-center font-display text-3xl">{guestsLabel}</span>
                <button
                  type="button"
                  onClick={() => setGuests(Math.min(p.maxGuests, guests + 1))}
                  className="grid h-12 w-12 place-items-center border border-paper/30 text-xl text-paper transition-colors hover:border-copper hover:text-copper-bright"
                  aria-label="More guests"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <Summary
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
            nightsLabel={nightsLabel}
            guestsLabel={guestsLabel}
            extraGuests={extraGuests}
            baseTotal={baseTotal}
            extraTotal={extraTotal}
            total={total}
          />
        </div>
      )}

      {/* ── STEP: DETAILS ────────────────────────────────────────────────── */}
      {step === "details" && (
        <div className="mt-12 grid gap-14 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="font-display text-2xl">{t.reserve.yourDetails}</h2>
            <div className="mt-8 space-y-6">
              <Field label={t.reserve.name} value={name} onChange={setName} type="text" required />
              <Field label={t.reserve.email} value={email} onChange={setEmail} type="email" required />
              <Field label={t.reserve.phone} value={phone} onChange={setPhone} type="tel" />
              <div>
                <label className="block text-xs tracking-[0.2em] text-paper-faint">
                  {t.reserve.notes.toUpperCase()}
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.reserve.notesPlaceholder}
                    rows={4}
                    className="mt-3 w-full border border-paper/20 bg-sumi-900 px-4 py-3 text-sm tracking-normal text-paper placeholder:text-paper-faint/60 focus:border-copper focus:outline-none"
                  />
                </label>
              </div>
            </div>
          </div>

          <Summary
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
            nightsLabel={nightsLabel}
            guestsLabel={guestsLabel}
            extraGuests={extraGuests}
            baseTotal={baseTotal}
            extraTotal={extraTotal}
            total={total}
          />
        </div>
      )}

      {/* ── STEP: CONFIRM ────────────────────────────────────────────────── */}
      {step === "confirm" && checkIn && checkOut && (
        <div className="mt-12 max-w-2xl">
          <h2 className="font-display text-2xl">{t.reserve.reviewTitle}</h2>
          <dl className="mt-8 divide-y divide-paper/10 border-y border-paper/10">
            <Row label={t.reserve.checkIn} value={formatDate(checkIn, lang)} />
            <Row label={t.reserve.checkOut} value={formatDate(checkOut, lang)} />
            <Row label={t.reserve.guests} value={guestsLabel} />
            <Row label={t.reserve.name} value={name} />
            <Row label={t.reserve.email} value={email} />
            {phone && <Row label={t.reserve.phone} value={phone} />}
            {notes && <Row label={t.reserve.notes} value={notes} />}
            <Row label={t.reserve.total} value={formatYen(total)} strong />
          </dl>
          {authEnabled && !user && (
            <p className="mt-6 border border-paper/15 bg-sumi-900 px-5 py-4 text-sm text-paper-dim">
              {t.auth.signInToConfirm}
            </p>
          )}
          {PAYMENTS_ON && authEnabled && user && (
            <p className="mt-6 border border-paper/15 bg-sumi-900 px-5 py-4 text-sm text-paper-dim">
              {t.reserve.payNote}
            </p>
          )}
        </div>
      )}

      {/* ── STEP: DONE ───────────────────────────────────────────────────── */}
      {step === "done" && confirmed && (
        <div className="mx-auto max-w-2xl pt-10 text-center">
          <p className="font-display text-6xl text-copper-bright">{site.kanji}</p>
          <h1 className="mt-8 font-display text-4xl md:text-5xl">{t.reserve.confirmedTitle}</h1>
          <p className="mt-4 text-xs tracking-[0.25em] text-paper-faint">
            {t.reserve.confirmationId.toUpperCase()}: <span className="text-copper-bright">{confirmed.id}</span>
          </p>
          <dl className="mt-10 divide-y divide-paper/10 border-y border-paper/10 text-left">
            <Row label={t.reserve.checkIn} value={formatDate(confirmed.checkIn, lang)} />
            <Row label={t.reserve.checkOut} value={formatDate(confirmed.checkOut, lang)} />
            <Row label={t.reserve.guests} value={fill(confirmed.guests === 1 ? t.reserve.guest_one : t.reserve.guest_other, { n: confirmed.guests })} />
            <Row label={t.reserve.total} value={formatYen(confirmed.totalYen)} strong />
          </dl>
          <p className="mt-8 text-sm leading-relaxed text-paper-faint">{t.reserve.confirmedBody}</p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              href="/reservations"
              className="border border-copper px-8 py-4 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
            >
              {t.reserve.viewReservations.toUpperCase()}
            </Link>
            <Link
              href="/"
              className="border border-paper/30 px-8 py-4 text-xs tracking-[0.25em] text-paper transition-all hover:border-paper"
            >
              {t.reserve.backHome.toUpperCase()}
            </Link>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      {step !== "done" && (
        <div className="mt-14 flex items-center justify-between border-t border-paper/10 pt-8">
          {step !== "dates" ? (
            <button
              onClick={back}
              className="border border-paper/30 px-8 py-4 text-xs tracking-[0.25em] text-paper transition-all hover:border-paper"
            >
              ← {t.reserve.back.toUpperCase()}
            </button>
          ) : (
            <span />
          )}
          {step === "confirm" ? (
            <button
              onClick={submit}
              disabled={submitting}
              className="border border-copper bg-copper/10 px-10 py-4 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950 disabled:opacity-50"
            >
              {(submitting
                ? t.reserve.booking
                : PAYMENTS_ON && authEnabled
                  ? t.reserve.payCta
                  : t.reserve.confirmBooking
              ).toUpperCase()}
            </button>
          ) : (
            <button
              onClick={next}
              className="border border-copper px-10 py-4 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
            >
              {t.reserve.continue.toUpperCase()} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function Field({
  label,
  value,
  onChange,
  type,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs tracking-[0.2em] text-paper-faint">
      {label.toUpperCase()}
      {required && <span className="text-copper-bright"> *</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-3 w-full border border-paper/20 bg-sumi-900 px-4 py-3 text-sm tracking-normal text-paper focus:border-copper focus:outline-none"
      />
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(110px,1fr)_2fr] gap-4 py-4">
      <dt className="text-xs tracking-[0.15em] text-paper-faint">{label.toUpperCase()}</dt>
      <dd className={strong ? "font-display text-lg text-copper-bright" : "text-sm text-paper"}>{value}</dd>
    </div>
  );
}

function Summary(props: {
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  nightsLabel: string;
  guestsLabel: string;
  extraGuests: number;
  baseTotal: number;
  extraTotal: number;
  total: number;
}) {
  const { t, lang } = useLang();
  const p = site.pricing;

  return (
    <aside className="h-fit border border-paper/15 bg-sumi-900 p-7 lg:sticky lg:top-28">
      <h3 className="text-xs tracking-[0.3em] text-paper-faint">{t.reserve.priceBreakdown.toUpperCase()}</h3>

      <div className="mt-6 grid grid-cols-2 gap-4 border-b border-paper/10 pb-6 text-sm">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-paper-faint">{t.reserve.checkIn.toUpperCase()}</p>
          <p className="mt-1.5 text-paper">{props.checkIn ? formatDate(props.checkIn, lang) : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.2em] text-paper-faint">{t.reserve.checkOut.toUpperCase()}</p>
          <p className="mt-1.5 text-paper">{props.checkOut ? formatDate(props.checkOut, lang) : "—"}</p>
        </div>
      </div>

      {props.nights > 0 ? (
        <div className="mt-6 space-y-3 text-sm text-paper-dim">
          <div className="flex justify-between gap-4">
            <span>
              {fill(t.reserve.baseRate, { nights: props.nightsLabel, rate: p.baseNightly.toLocaleString("ja-JP") })}
            </span>
            <span className="text-paper">{formatYen(props.baseTotal)}</span>
          </div>
          {props.extraGuests > 0 && (
            <div className="flex justify-between gap-4">
              <span>
                {fill(t.reserve.extraGuests, {
                  n: props.extraGuests,
                  rate: p.perGuestNightly.toLocaleString("ja-JP"),
                  nights: props.nights,
                })}
              </span>
              <span className="text-paper">{formatYen(props.extraTotal)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span>{t.reserve.cleaningFee}</span>
            <span className="text-paper">{formatYen(p.cleaningFee)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-paper/10 pt-4">
            <span className="tracking-[0.2em] text-paper">{t.reserve.total.toUpperCase()}</span>
            <span className="font-display text-xl text-copper-bright">{formatYen(props.total)}</span>
          </div>
          <p className="pt-2 text-xs text-paper-faint">{fill(t.reserve.includedNote, { n: p.includedGuests })}</p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-paper-faint">{t.reserve.selectDatesHint}</p>
      )}
    </aside>
  );
}
