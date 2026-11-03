import { ConvexError } from "convex/values";

/**
 * A message fit for a toast. Convex functions throw ConvexError for messages meant for the user;
 * any other server error arrives as "[CONVEX A(...)] [Request ID: ...] Server Error ...", so it
 * gets the fallback instead.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  if (error instanceof Error && error.message && !error.message.startsWith("[CONVEX")) {
    return error.message;
  }
  return fallback;
}
