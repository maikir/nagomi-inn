"use client";

import { useLang } from "@/lib/i18n/LanguageProvider";
import { privacyPolicy } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

export default function PrivacyPage() {
  const { lang } = useLang();
  const p = privacyPolicy(lang);
  return <LegalPage title={p.title} note={p.note} effective={p.effective} sections={p.sections} />;
}
