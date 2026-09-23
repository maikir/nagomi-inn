const HAS_LETTER = new RegExp("\\p{L}", "u");
const NAME_CHARACTERS = new RegExp("^[\\p{L}\\p{M}\\p{Zs}\\p{P}\\u200C\\u200D]+$", "u");
const DOMAIN_LABEL = new RegExp("^[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]*[\\p{L}\\p{N}])?$", "u");

/** Keep international names and IME input intact; validate after typing. */
export function validGuestName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const name = value.trim();
  return name.length > 0 && name.length <= 100 && HAS_LETTER.test(name) && NAME_CHARACTERS.test(name);
}

export function validGuestEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return false;
  const [local, domain] = email.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") &&
    !local.includes("..") && !/["(),:;\\\[\]]/.test(local) && domain.split(".").every(label => DOMAIN_LABEL.test(label));
}

export function normalizeGuestPhone(value: string): string {
  return value.normalize("NFKC").replace(/[\u0660-\u0669\u06F0-\u06F9]/g, digit =>
    String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06F0 ? 0x06F0 : 0x0660))).trim();
}

export function validGuestPhone(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" || value.length > 40) return false;
  const phone = normalizeGuestPhone(value);
  if (!phone) return true;
  const digits = phone.replace(/\D/g, "");
  return /^\+?[0-9 ().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
}
