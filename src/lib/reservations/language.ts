export type ReservationLanguage = "en" | "ja";

/** First explicit supported language wins; missing/auto/unsupported values do not. */
export function reservationLanguage(...preferences: unknown[]): ReservationLanguage {
  return preferences.find((value): value is ReservationLanguage => value === "en" || value === "ja") ?? "en";
}
