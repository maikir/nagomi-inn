"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { defaultPricing, type Pricing } from "@/lib/pricing";
import { commerceDisclosure } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

/** 特定商取引法に基づく表記 (required for online sales in Japan). */
export default function CommerceDisclosurePage() {
  const { t, lang } = useLang();
  // Same live pricing the reserve page and checkout use, so the listed price
  // always matches what guests are charged.
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);
  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json.baseNightly === "number") setPricing(json as Pricing);
      })
      .catch(() => {});
  }, []);
  const d = commerceDisclosure(lang, t, pricing);
  return <LegalPage title={d.title} note={d.note} rows={d.rows} />;
}
