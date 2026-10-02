"use client";

import { useLang } from "@/lib/i18n/LanguageProvider";
import { commerceDisclosure } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

/** 特定商取引法に基づく表記 (required for online sales in Japan). */
export default function CommerceDisclosurePage() {
  const { t, lang } = useLang();
  const d = commerceDisclosure(lang, t);
  return <LegalPage title={d.title} note={d.note} rows={d.rows} />;
}
