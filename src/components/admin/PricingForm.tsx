"use client";

import { useState } from "react";
import { useLang, fill } from "@/lib/i18n/LanguageProvider";
import { formatYen } from "@/config/site";
import { computeBreakdown, defaultPricing, type EditablePricing, type Pricing } from "@/lib/pricing";

/**
 * Owner pricing editor. Saves through the admin-gated /api/admin/pricing route;
 * the reserve page and checkout pick up the new values immediately.
 */
export function PricingForm({
  initial,
  authedFetch,
}: {
  initial: Pricing;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response | null>;
}) {
  const { t } = useLang();
  const [form, setForm] = useState<EditablePricing>({
    baseNightly: initial.baseNightly,
    includedGuests: initial.includedGuests,
    perGuestNightly: initial.perGuestNightly,
    cleaningFee: initial.cleaningFee,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const set = (k: keyof EditablePricing) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === "" ? 0 : Math.max(0, Math.round(Number(e.target.value)));
    setForm((f) => ({ ...f, [k]: Number.isFinite(v) ? v : 0 }));
    setMsg(null);
  };

  // Live example using the structural limits from defaults (max guests, a 2-night stay).
  const exampleGuests = defaultPricing.maxGuests;
  const preview = computeBreakdown({ ...defaultPricing, ...form }, 2, exampleGuests);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await authedFetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res || !res.ok) throw new Error();
      setMsg({ tone: "ok", text: t.admin.pricingSaved });
    } catch {
      setMsg({ tone: "error", text: t.admin.pricingError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 max-w-xl">
      <p className="text-sm text-paper-dim">{t.admin.pricingIntro}</p>

      <div className="mt-8 space-y-7">
        <YenField
          label={t.admin.pricingBase}
          hint={t.admin.pricingBaseHint}
          value={form.baseNightly}
          onChange={set("baseNightly")}
          yen={t.admin.pricingYen}
        />
        <NumField
          label={t.admin.pricingIncluded}
          value={form.includedGuests}
          onChange={set("includedGuests")}
          unit={t.admin.pricingGuestsUnit}
          min={defaultPricing.minGuests}
          max={defaultPricing.maxGuests}
        />
        <YenField
          label={t.admin.pricingPerGuest}
          hint={t.admin.pricingPerGuestHint}
          value={form.perGuestNightly}
          onChange={set("perGuestNightly")}
          yen={t.admin.pricingYen}
        />
        <YenField
          label={t.admin.pricingCleaning}
          value={form.cleaningFee}
          onChange={set("cleaningFee")}
          yen={t.admin.pricingYen}
        />
      </div>

      {/* Live example */}
      <p className="mt-8 border-l-2 border-copper/60 pl-4 text-sm text-paper-dim">
        {fill(t.admin.pricingPreview, {
          guests: exampleGuests,
          nights: 2,
          total: formatYen(preview.total),
        })}
      </p>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2.5 border border-copper bg-copper/10 px-8 py-3.5 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950 disabled:pointer-events-none disabled:opacity-60"
        >
          {saving && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent"
              aria-hidden="true"
            />
          )}
          {(saving ? t.admin.pricingSaving : t.admin.pricingSave).toUpperCase()}
        </button>
        {msg && (
          <span className={`text-sm ${msg.tone === "ok" ? "text-moss" : "text-copper-bright"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}

function YenField({
  label,
  hint,
  value,
  onChange,
  yen,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  yen: string;
}) {
  return (
    <label className="block">
      <span className="text-xs tracking-[0.15em] text-paper-faint">{label.toUpperCase()}</span>
      <div className="mt-2.5 flex items-center border border-paper/20 bg-sumi-950 focus-within:border-copper">
        <span className="pl-4 text-paper-faint">{yen}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={value}
          onChange={onChange}
          className="w-full bg-transparent px-3 py-3 text-sm text-paper focus:outline-none"
        />
      </div>
      {hint && <span className="mt-1.5 block text-xs text-paper-faint">{hint}</span>}
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  unit: string;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="text-xs tracking-[0.15em] text-paper-faint">{label.toUpperCase()}</span>
      <div className="mt-2.5 flex items-center border border-paper/20 bg-sumi-950 focus-within:border-copper">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={onChange}
          className="w-full bg-transparent px-4 py-3 text-sm text-paper focus:outline-none"
        />
        <span className="pr-4 text-paper-faint">{unit}</span>
      </div>
    </label>
  );
}
