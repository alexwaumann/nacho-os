import { findBestAddressMatch } from "../address";
import { toIsoDate } from "../date";

/** What Gemini read off a check photo (`api.ai.analyzeCheck`); every field may be missing */
export interface CheckReading {
  amount?: number;
  payerName?: string;
  date?: string;
  detectedAddress?: string;
}

/** A check that was read well enough to save */
export interface ScannedCheck {
  amount: number;
  payerName?: string;
  /** YYYY-MM-DD */
  date: string;
  /** The job address from the memo line, if there was one */
  detectedAddress?: string;
}

export const CHECK_AMOUNT_MISSING = "Could not read the amount. Try a closer, flatter photo.";

/**
 * Turn a check reading into what gets saved, like the web's scan flow: a missing (or zero)
 * amount is an error and a missing date is today.
 */
export function toScannedCheck(reading: CheckReading, today: Date = new Date()): ScannedCheck {
  if (!reading.amount) throw new Error(CHECK_AMOUNT_MISSING);

  return {
    amount: reading.amount,
    payerName: reading.payerName?.trim() || undefined,
    date: toIsoDate(reading.date, today),
    detectedAddress: reading.detectedAddress?.trim() || undefined,
  };
}

/**
 * Order unpaid jobs for picking which job a check pays for: the job whose address best matches
 * the check's memo goes first (checks usually carry the job address), the rest keep their order.
 */
export function rankJobsForCheck<T extends { _id: string; address: string }>(
  detectedAddress: string | undefined,
  unpaidJobs: Array<T>,
): { recommendedJob: T | null; jobs: Array<T> } {
  const recommendedJob = detectedAddress ? findBestAddressMatch(detectedAddress, unpaidJobs) : null;
  const jobs =
    recommendedJob ?
      [recommendedJob, ...unpaidJobs.filter((job) => job._id !== recommendedJob._id)]
    : unpaidJobs;
  return { recommendedJob, jobs };
}
