import { toIsoDate } from "../date";

/** What Gemini read off a receipt photo (`api.ai.analyzeReceipt`); every field may be missing */
export interface ReceiptReading {
  storeName?: string;
  storeLocation?: string;
  summary?: string;
  total?: number;
  date?: string;
}

/** A receipt that was read well enough to save */
export interface ScannedReceipt {
  storeName: string;
  storeLocation?: string;
  summary?: string;
  total: number;
  /** YYYY-MM-DD */
  date: string;
}

export const RECEIPT_TOTAL_MISSING = "Could not read the total. Try a closer, flatter photo.";

/**
 * Turn a receipt reading into what gets saved, like the web's scan flow: a missing (or zero)
 * total is an error, a missing store is "Unknown store" and a missing date is today.
 */
export function toScannedReceipt(
  reading: ReceiptReading,
  today: Date = new Date(),
): ScannedReceipt {
  if (!reading.total) throw new Error(RECEIPT_TOTAL_MISSING);

  return {
    storeName: reading.storeName?.trim() || "Unknown store",
    storeLocation: reading.storeLocation?.trim() || undefined,
    summary: reading.summary?.trim() || undefined,
    total: reading.total,
    date: toIsoDate(reading.date, today),
  };
}
