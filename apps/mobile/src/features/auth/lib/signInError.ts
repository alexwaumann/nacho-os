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
  user_locked: "Too many wrong tries, so sign-in is locked for a while. Try again later.",
  form_password_pwned:
    "That password showed up in a data leak, so it can't be used. Ask for a new password.",
  form_code_incorrect: "That code isn't right. Check it and try again.",
  verification_expired: "That code has expired. Tap Resend code for a new one.",
  verification_failed: "That code didn't work. Tap Back and start over.",
  network_error: "No connection. Check your signal and try again.",
};

/** The Clerk error code (e.g. "session_exists"), if it is a Clerk error */
export function getSignInErrorCode(error: unknown): string | undefined {
  const clerkError = (error ?? {}) as ClerkLikeError;
  return (clerkError.errors?.[0] ?? clerkError).code;
}

/** A plain message for a failed sign-in step, from a Clerk error (or anything else thrown). */
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
