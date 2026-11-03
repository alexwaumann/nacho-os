/**
 * Normalize a date read off a scanned document to YYYY-MM-DD.
 * Accepts MM/DD/YYYY or YYYY-MM-DD; anything else (or nothing) falls back to today.
 */
export function toIsoDate(dateStr: string | undefined, today: Date = new Date()): string {
  // Use the local calendar day (toISOString would roll over to tomorrow on US evenings)
  const fallback = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const value = dateStr?.trim();
  if (!value) return fallback;

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return fallback;
}
