interface ClerkErrorDetail {
  code?: string;
  message?: string;
  longMessage?: string;
}

interface ClerkLikeError extends ClerkErrorDetail {
  /** Set on Clerk API errors (ClerkAPIResponseError): the codes live here */
  errors?: ClerkErrorDetail[];
}

const messageForCode: Record<string, string> = {
  form_identifier_not_found: "No account with that username.",
  form_password_incorrect: "That password isn't right. Try again.",
  too_many_requests: "Too many tries. Wait a minute, then try again.",
  network_error: "No connection. Check your signal and try again.",
};

/** A plain message for a failed sign-in, from a Clerk error (or anything else that was thrown). */
export function getSignInErrorMessage(error: unknown): string {
  const clerkError = (error ?? {}) as ClerkLikeError;
  const detail = clerkError.errors?.[0] ?? clerkError;
  const known = detail.code ? messageForCode[detail.code] : undefined;
  return (
    known ||
    detail.longMessage ||
    detail.message ||
    clerkError.message ||
    "Couldn't sign in. Please try again."
  );
}
