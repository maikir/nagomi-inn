/**
 * Guest address — required for the guest registry (旅館業法). Stored as three
 * fields: ISO 3166-1 alpha-2 country code, postal code, and the address text.
 * Country names are localized at display time with Intl.DisplayNames.
 */

// ISO 3166-1 alpha-2, current assignments.
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO " +
  "JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR " +
  "MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO " +
  "RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV " +
  "TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";
export const COUNTRY_CODES: readonly string[] = CODES.split(" ");

export const ADDRESS_MAX = 200;

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && COUNTRY_CODES.includes(value);
}

const namesCache = new Map<string, Intl.DisplayNames | null>();
export function countryName(code: string, lang: "en" | "ja"): string {
  if (!namesCache.has(lang)) {
    try {
      namesCache.set(lang, new Intl.DisplayNames([lang], { type: "region" }));
    } catch {
      namesCache.set(lang, null);
    }
  }
  return namesCache.get(lang)?.of(code) ?? code;
}

/** Countries sorted by localized name, with Japan first (most guests). */
export function countryOptions(lang: "en" | "ja"): { code: string; name: string }[] {
  const collator = new Intl.Collator(lang);
  const rest = COUNTRY_CODES.filter((c) => c !== "JP")
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return [{ code: "JP", name: countryName("JP", lang) }, ...rest];
}

/** Full-width digits and the many dash look-alikes Japanese IMEs produce → "123-4567". */
export function normalizePostalCode(value: string, country: string): string {
  const v = value.normalize("NFKC").replace(/[‐‑‒–—―ー−－]/g, "-").trim();
  if (country === "JP") {
    const digits = v.replace(/\D/g, "");
    return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : v;
  }
  return v.replace(/\s+/g, " ").toUpperCase();
}

/** Required (7 digits) for Japan; optional elsewhere, since some countries have none. */
export function validPostalCode(value: unknown, country: string): boolean {
  if (value === undefined || value === null || value === "") return country !== "JP";
  if (typeof value !== "string" || value.length > 20) return false;
  const v = normalizePostalCode(value, country);
  if (country === "JP") return /^\d{3}-\d{4}$/.test(v);
  return v === "" || /^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(v);
}

const LETTER_OR_DIGIT = new RegExp("[\\p{L}\\p{N}]", "u");

export function validAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return v.length >= 4 && v.length <= ADDRESS_MAX && LETTER_OR_DIGIT.test(v);
}

/** One line for review screens: 〒123-4567 宮崎県… / "…, 12345, United States". */
export function formatAddress(
  a: { country?: string | null; postalCode?: string | null; address?: string | null },
  lang: "en" | "ja",
): string {
  if (!a.address) return "";
  const country = a.country ? countryName(a.country, lang) : "";
  if (lang === "ja") {
    const postal = a.postalCode ? `〒${a.postalCode} ` : "";
    return `${postal}${a.address}${a.country && a.country !== "JP" ? `（${country}）` : ""}`;
  }
  return [a.address, a.postalCode, country].filter(Boolean).join(", ");
}
