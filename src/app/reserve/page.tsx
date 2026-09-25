"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLang, fill, resolveMessage, type Message } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { site, formatYen } from "@/config/site";
import { defaultPricing, computeBreakdown, type Pricing } from "@/lib/pricing";
import { RangeCalendar } from "@/components/reserve/RangeCalendar";
import { LogoMark } from "@/components/LogoMark";
import { validGuestName, validGuestEmail, validGuestPhone, normalizeGuestPhone } from "@/lib/reservations/validation";
import {
  ARRIVAL_TIMES,
  isAmenityPlan,
  isArrivalTime,
  amenityPlanLabel,
  arrivalTimeLabel,
  type AmenityPlan,
  type ArrivalTime,
} from "@/lib/reservations/stayPlans";
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
  arrivalTime?: string;
  bbqPlan?: string;
  saunaPlan?: string;
  registryAck?: boolean;
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
  // Stay plans (asked up front so the hosts can prepare) + registry notice.
  const [arrivalTime, setArrivalTime] = useState<ArrivalTime | "">("");
  const [bbqPlan, setBbqPlan] = useState<AmenityPlan | "">("");
  const [saunaPlan, setSaunaPlan] = useState<AmenityPlan | "">("");
  const [registryAck, setRegistryAck] = useState(false);
  const [registryAttempted, setRegistryAttempted] = useState(false);
  const [error, setError] = useState<Message | null>(null);
  const [detailsAttempted, setDetailsAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);
  // Saving is disabled until restoration has committed — the flag is set in the
  // same batch as the restored values, so a save can never observe pre-restore
  // state (this also survives StrictMode's double effect run in dev).
  const [draftReady, setDraftReady] = useState(false);
  // Live pricing from the DB (owner-editable); starts at the built-in defaults
  // and updates once fetched, so the estimate matches what checkout will charge.
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);

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
        setArrivalTime(isArrivalTime(d.arrivalTime) ? d.arrivalTime : "");
        setBbqPlan(isAmenityPlan(d.bbqPlan) ? d.bbqPlan : "");
        setSaunaPlan(isAmenityPlan(d.saunaPlan) ? d.saunaPlan : "");
        setRegistryAck(d.registryAck === true);
      }
    } catch {}
    setDraftReady(true);
  }, []);

  // Keep the draft current while the visitor fills the form.
  useEffect(() => {
    if (!draftReady || step === "done") return;
    const draft: Draft = { step, checkIn, checkOut, guests, name, email, phone, notes, arrivalTime, bbqPlan, saunaPlan, registryAck };
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draftReady, step, checkIn, checkOut, guests, name, email, phone, notes, arrivalTime, bbqPlan, saunaPlan, registryAck]);

  // Load current pricing (falls back to defaults on any error / demo mode).
  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json.baseNightly === "number") setPricing(json as Pricing);
      })
      .catch(() => {});
  }, []);

  // Signed-in guests get their details prefilled.
  useEffect(() => {
    if (!user) return;
    setEmail((cur) => cur || user.email || "");
    const fullName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
    if (fullName) setName((cur) => cur || fullName);
  }, [user]);

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const p = pricing;
  const { extraGuests, baseTotal, extraTotal, total } = computeBreakdown(p, nights, guests);

  const nightsLabel = fill(nights === 1 ? t.reserve.nights_one : t.reserve.nights_other, { n: nights });
  const guestsLabel = fill(guests === 1 ? t.reserve.guest_one : t.reserve.guest_other, { n: guests });

  function validateDetails() {
    setDetailsAttempted(true);
    if (!validGuestName(name)) {
      setError({ key: "reserve.errorName" });
      return false;
    }
    if (!validGuestEmail(email)) {
      setError({ key: "reserve.errorEmail" });
      return false;
    }
    if (!validGuestPhone(phone)) {
      setError({ key: "reserve.errorPhone" });
      return false;
    }
    if (!isArrivalTime(arrivalTime) || !isAmenityPlan(bbqPlan) || !isAmenityPlan(saunaPlan)) {
      setError({ key: "reserve.errorPlans" });
      return false;
    }
    return true;
  }

  function next() {
    setError(null);
    if (step === "dates") {
      if (!checkIn || !checkOut || nights < p.minNights) return setError({ key: "reserve.errorDates" });
      setStep("details");
    } else if (step === "details") {
      if (!validateDetails()) return;
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
    if (!validateDetails()) { setStep("details"); return; }
    if (!registryAck) {
      setRegistryAttempted(true);
      setError({ key: "reserve.errorRegistry" });
      return;
    }
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
            phone: normalizeGuestPhone(phone) || undefined,
            notes: notes.trim() || undefined,
            lang,
            arrivalTime,
            bbqPlan,
            saunaPlan,
            registryAck,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.ok && json.url) {
          window.location.href = json.url;
          return; // keep `submitting` on while the browser navigates to Stripe
        }
        if (json.error === "UNAVAILABLE") {
          setError({ key: "reserve.errorUnavailable" });
          setBooked(await store.bookedDates());
          setStep("dates");
        } else if (json.error === "AUTH_REQUIRED") {
          router.push("/login?next=/reserve");
        } else {
          setError({ key: "reserve.payError" });
        }
      } catch {
        setError({ key: "reserve.payError" });
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
        phone: normalizeGuestPhone(phone) || undefined,
        notes: notes.trim() || undefined,
        totalYen: total,
        arrivalTime: arrivalTime || undefined,
        bbqPlan: bbqPlan || undefined,
        saunaPlan: saunaPlan || undefined,
        registryAckAt: new Date().toISOString(),
      });
      setConfirmed(reservation);
      setStep("done");
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof Error && e.message === "UNAVAILABLE") {
        setError({ key: "reserve.errorUnavailable" });
        setBooked(await store.bookedDates());
        setStep("dates");
      } else if (e instanceof Error && e.message === "AUTH_REQUIRED") {
        router.push("/login?next=/reserve");
      } else {
        setError({ key: String(e) });
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
          {resolveMessage(t, error)}
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
                  onClick={() => setGuests(Math.max(p.minGuests, guests - 1))}
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
            pricing={p}
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
              <Field id="guest-name" label={t.reserve.name} value={name} onChange={setName} type="text" autoComplete="name" maxLength={100} required attempted={detailsAttempted} error={validGuestName(name) ? undefined : t.reserve.errorName} />
              <Field id="guest-email" label={t.reserve.email} value={email} onChange={setEmail} type="email" autoComplete="email" maxLength={254} required attempted={detailsAttempted} error={validGuestEmail(email) ? undefined : t.reserve.errorEmail} />
              <Field id="guest-phone" label={t.reserve.phone} value={phone} onChange={setPhone} type="tel" autoComplete="tel" maxLength={40} attempted={detailsAttempted} error={validGuestPhone(phone) ? undefined : t.reserve.errorPhone} hint={t.reserve.phoneHint} />
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

            <div className="mt-10 border-t border-paper/10 pt-8">
              <h2 className="font-display text-2xl">{t.reserve.stayPlansTitle}</h2>
              <p className="mt-2 text-sm text-paper-faint">{t.reserve.stayPlansHint}</p>
              <div className="mt-8 space-y-7">
                <div>
                  <label htmlFor="arrival-time" className="block text-xs tracking-[0.2em] text-paper-faint">
                    {t.reserve.arrivalTime.toUpperCase()}
                    <span className="text-copper-bright"> *</span>
                  </label>
                  <select
                    id="arrival-time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value as ArrivalTime | "")}
                    className={`mt-3 w-full border bg-sumi-900 px-4 py-3 text-sm text-paper focus:border-copper focus:outline-none ${
                      detailsAttempted && !arrivalTime ? "border-copper" : "border-paper/20"
                    }`}
                  >
                    <option value="" disabled>
                      {t.reserve.arrivalChoose}
                    </option>
                    {ARRIVAL_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {arrivalTimeLabel(time, t.reserve)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-paper-faint">{t.reserve.arrivalHint}</p>
                </div>
                <ChoiceGroup
                  name="bbq-plan"
                  label={t.reserve.bbq}
                  hint={t.reserve.bbqHint}
                  value={bbqPlan}
                  onChange={setBbqPlan}
                  invalid={detailsAttempted && !bbqPlan}
                />
                <ChoiceGroup
                  name="sauna-plan"
                  label={t.reserve.sauna}
                  value={saunaPlan}
                  onChange={setSaunaPlan}
                  invalid={detailsAttempted && !saunaPlan}
                />
              </div>
            </div>
          </div>

          <Summary
            pricing={p}
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
            {arrivalTime && <Row label={t.reserve.arrivalTime} value={arrivalTimeLabel(arrivalTime, t.reserve)} />}
            {bbqPlan && <Row label={t.reserve.bbq} value={amenityPlanLabel(bbqPlan, t.reserve)} />}
            {saunaPlan && <Row label={t.reserve.sauna} value={amenityPlanLabel(saunaPlan, t.reserve)} />}
            <Row label={t.reserve.total} value={formatYen(total)} strong />
          </dl>

          {/* Nothing to arrange when both are already a yes. */}
          {!(bbqPlan === "yes" && saunaPlan === "yes") && (
            <div className="mt-8 border border-paper/15 bg-sumi-900 px-5 py-5">
              <h3 className="text-xs tracking-[0.2em] text-paper-faint">{t.reserve.amenityNoticeTitle.toUpperCase()}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper-dim">{t.reserve.amenityNotice}</p>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <a href={`mailto:${site.contact.email}`} className="text-copper-bright transition-colors hover:text-paper">
                  {site.contact.email}
                </a>
                <a href={`tel:${site.contact.phone.replace(/[^+\d]/g, "")}`} className="text-copper-bright transition-colors hover:text-paper">
                  {site.contact.phone}
                </a>
              </p>
            </div>
          )}

          <div
            className={`mt-8 border bg-sumi-900 px-5 py-5 ${
              registryAttempted && !registryAck ? "border-copper/70" : "border-paper/15"
            }`}
          >
            <h3 className="text-xs tracking-[0.2em] text-paper-faint">{t.reserve.registryTitle.toUpperCase()}</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper-dim">{t.reserve.registryBody}</p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-paper">
              <input
                type="checkbox"
                checked={registryAck}
                onChange={(e) => {
                  setRegistryAck(e.target.checked);
                  if (e.target.checked && error?.key === "reserve.errorRegistry") setError(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
              />
              <span>
                {t.reserve.registryAck}
                <span className="text-copper-bright"> *</span>
              </span>
            </label>
          </div>

          <div className="mt-6">
            <h3 className="text-xs tracking-[0.2em] text-paper-faint">{t.reserve.goodToKnowTitle.toUpperCase()}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-paper-dim">
              <li>・{t.reserve.goodToKnowCheckin}</li>
              <li>・{t.reserve.goodToKnowToothbrush}</li>
            </ul>
          </div>
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
          <div className="flex justify-center">
            <LogoMark size="lg" />
          </div>
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

/** Yes / No / Not sure yet, as native radios styled like segmented buttons. */
function ChoiceGroup({
  name,
  label,
  hint,
  value,
  onChange,
  invalid,
}: {
  name: string;
  label: string;
  hint?: string;
  value: AmenityPlan | "";
  onChange: (v: AmenityPlan) => void;
  invalid?: boolean;
}) {
  const { t } = useLang();
  const options: AmenityPlan[] = ["yes", "no", "undecided"];
  return (
    <fieldset>
      <legend className="text-xs tracking-[0.2em] text-paper-faint">
        {label.toUpperCase()}
        <span className="text-copper-bright"> *</span>
      </legend>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={`cursor-pointer border px-3 py-3 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-copper ${
              value === option
                ? "border-copper bg-copper/10 text-copper-bright"
                : invalid
                  ? "border-copper/60 text-paper-dim hover:border-copper"
                  : "border-paper/20 text-paper-dim hover:border-paper/40 hover:text-paper"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {amenityPlanLabel(option, t.reserve)}
          </label>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-paper-faint">{hint}</p>}
    </fieldset>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type,
  required,
  autoComplete,
  maxLength,
  error,
  hint,
  attempted,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  error?: string;
  hint?: string;
  attempted?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const visibleError = (touched || attempted) ? error : undefined;
  return (
    <label className="block text-xs tracking-[0.2em] text-paper-faint">
      {label.toUpperCase()}
      {required && <span className="text-copper-bright"> *</span>}
      <input
        id={id}
        name={autoComplete}
        type={type}
        inputMode={type === "tel" ? "tel" : type === "email" ? "email" : "text"}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        onBlur={() => setTouched(true)}
        aria-invalid={Boolean(visibleError)}
        aria-describedby={visibleError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="mt-3 w-full border border-paper/20 bg-sumi-900 px-4 py-3 text-sm tracking-normal text-paper focus:border-copper focus:outline-none"
      />
      {visibleError ? <span id={`${id}-error`} role="alert" className="mt-2 block text-xs tracking-normal text-copper-bright">{visibleError}</span>
        : hint ? <span id={`${id}-hint`} className="mt-2 block text-xs tracking-normal text-paper-faint">{hint}</span> : null}
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
  pricing: Pricing;
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
  const p = props.pricing;

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

      {/* Cancellation policy */}
      <div className="mt-8 border-t border-paper/10 pt-6">
        <h4 className="text-[10px] tracking-[0.3em] text-paper-faint">{t.reserve.policyTitle.toUpperCase()}</h4>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-paper-faint">
          <li>{t.reserve.policyFree}</li>
          <li>{t.reserve.policyHalf}</li>
          <li>{t.reserve.policyFull}</li>
        </ul>
      </div>
    </aside>
  );
}
