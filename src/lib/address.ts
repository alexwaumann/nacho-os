/**
 * Address matching utilities for comparing extracted addresses with job addresses
 */

/**
 * Normalize an address for comparison by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Removing common street suffixes
 * - Removing unit/apartment designations
 * - Collapsing whitespace
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#-]/g, " ")
    .replace(
      /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl|circle|cir)\b/gi,
      "",
    )
    .replace(/\b(apartment|apt|unit|suite|ste|#)\b\s*\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate similarity score (0-1) between two addresses using Jaccard similarity on words.
 * A short street address ("928 Burgan St", as written in a check memo) inside a full one
 * ("928 Burgan St, Waco, TX 76704") also scores 1, as long as the house numbers match.
 */
export function addressSimilarity(addr1: string, addr2: string): number {
  const tokens1 = normalizeAddress(addr1).split(" ").filter(Boolean);
  const tokens2 = normalizeAddress(addr2).split(" ").filter(Boolean);
  const words1 = new Set(tokens1);
  const words2 = new Set(tokens2);

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  const jaccard = intersection.size / union.size;

  // Only trust containment when both start with the same house number and share a street word,
  // so "Waco TX" doesn't match every job in Waco
  const isSameHouseNumber = /^\d+$/.test(tokens1[0]) && tokens1[0] === tokens2[0];
  if (!isSameHouseNumber || intersection.size < 2) {
    return jaccard;
  }

  const containment = intersection.size / Math.min(words1.size, words2.size);
  return Math.max(jaccard, containment);
}

/**
 * Find the best matching job from a list based on address similarity
 * Returns the job with highest similarity score if it meets the threshold
 */
export function findBestAddressMatch<T extends { address: string }>(
  checkAddress: string,
  jobs: Array<T>,
  threshold = 0.7,
): T | null {
  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const job of jobs) {
    const score = addressSimilarity(checkAddress, job.address);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = job;
    }
  }

  return bestMatch;
}
