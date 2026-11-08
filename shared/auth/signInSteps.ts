/**
 * What the sign-in screen shows after Clerk answers, from the sign-in's `status` and the factors
 * it offers. Typed structurally (no Clerk import) so it stays framework-free: Clerk's
 * `SignInFutureResource` (`useSignIn().signIn` in `@clerk/expo`) fits these shapes.
 *
 * The Clerk instance today only allows username + password and has no second factor, so a
 * password sign-in completes at once. These steps cover what Clerk can still ask a new phone for
 * if settings change: a code by email or text (first factor, second factor, or "client trust"
 * for a new device), an authenticator or backup code, or a new password.
 */

/** How the code is delivered or made */
export type SignInCodeMethod = "email_code" | "phone_code" | "totp" | "backup_code";

/** Which part of the sign-in the code is for; decides the Clerk call that checks it */
export type SignInCodeStage = "first_factor" | "second_factor" | "client_trust";

export interface SignInFactorLike {
  strategy: string;
  /** Masked email or phone, e.g. "j***@gmail.com" */
  safeIdentifier?: string;
  primary?: boolean | null;
}

export interface SignInStateLike {
  status: string | null;
  supportedFirstFactors?: ReadonlyArray<SignInFactorLike> | null;
  supportedSecondFactors?: ReadonlyArray<SignInFactorLike> | null;
}

export type SignInStep =
  | { kind: "done" }
  | {
      kind: "code";
      stage: SignInCodeStage;
      method: SignInCodeMethod;
      /** Where the code went (masked), for email and text codes */
      sentTo: string | null;
    }
  | { kind: "new_password" }
  | { kind: "unsupported"; status: string | null; message: string };

export type SignInCodeStep = Extract<SignInStep, { kind: "code" }>;

export const UNSUPPORTED_STEP_MESSAGE =
  "This account needs a sign-in step the app can't do yet. Ask for help signing in.";

// Codes that arrive by email or text first: iOS offers them above the keyboard
const FIRST_FACTOR_METHODS: Array<SignInCodeMethod> = ["email_code", "phone_code"];
const SECOND_FACTOR_METHODS: Array<SignInCodeMethod> = [
  "phone_code",
  "email_code",
  "totp",
  "backup_code",
];
const CLIENT_TRUST_METHODS: Array<SignInCodeMethod> = ["email_code", "phone_code"];

function pickFactor(
  factors: ReadonlyArray<SignInFactorLike> | null | undefined,
  methods: Array<SignInCodeMethod>,
): { method: SignInCodeMethod; factor: SignInFactorLike } | null {
  for (const method of methods) {
    const matches = (factors ?? []).filter((factor) => factor.strategy === method);
    const factor = matches.find((match) => match.primary) ?? matches.at(0);
    if (factor) return { method, factor };
  }
  return null;
}

function codeStep(
  stage: SignInCodeStage,
  factors: ReadonlyArray<SignInFactorLike> | null | undefined,
  methods: Array<SignInCodeMethod>,
  status: string,
): SignInStep {
  const picked = pickFactor(factors, methods);
  if (!picked) return { kind: "unsupported", status, message: UNSUPPORTED_STEP_MESSAGE };
  return {
    kind: "code",
    stage,
    method: picked.method,
    sentTo: picked.factor.safeIdentifier || null,
  };
}

/** The next step after Clerk answered (a password, a code or a new password was sent) */
export function getSignInStep(signIn: SignInStateLike): SignInStep {
  const { status } = signIn;
  switch (status) {
    case "complete":
      return { kind: "done" };
    case "needs_first_factor":
      // The password didn't finish it, but Clerk offers a code instead
      return codeStep("first_factor", signIn.supportedFirstFactors, FIRST_FACTOR_METHODS, status);
    case "needs_second_factor":
      return codeStep(
        "second_factor",
        signIn.supportedSecondFactors,
        SECOND_FACTOR_METHODS,
        status,
      );
    case "needs_client_trust":
      // A new device: Clerk checks it with a code, through the second-factor calls
      return codeStep("client_trust", signIn.supportedSecondFactors, CLIENT_TRUST_METHODS, status);
    case "needs_new_password":
      return { kind: "new_password" };
    default:
      // needs_identifier, needs_protect_check (bot check), or something newer
      return { kind: "unsupported", status, message: UNSUPPORTED_STEP_MESSAGE };
  }
}

/** Email and text codes can be sent again; authenticator and backup codes can't */
export function canResendCode(step: SignInCodeStep): boolean {
  return step.method === "email_code" || step.method === "phone_code";
}

/** The plain sentence above the code field */
export function describeCodeStep(step: SignInCodeStep): string {
  switch (step.method) {
    case "email_code":
      return step.sentTo ?
          `Enter the code we sent to ${step.sentTo}.`
        : "Enter the code we sent to your email.";
    case "phone_code":
      return step.sentTo ?
          `Enter the code we texted to ${step.sentTo}.`
        : "Enter the code we texted to your phone.";
    case "totp":
      return "Enter the 6-digit code from your authenticator app.";
    case "backup_code":
      return "Enter one of your backup codes.";
  }
}

type ClerkCall = Promise<{ error: unknown }>;

/** The parts of Clerk's SignInFuture used to send and check codes */
export interface SignInCodeApi {
  emailCode: { sendCode: () => ClerkCall; verifyCode: (params: { code: string }) => ClerkCall };
  phoneCode: { sendCode: () => ClerkCall; verifyCode: (params: { code: string }) => ClerkCall };
  mfa: {
    sendEmailCode: () => ClerkCall;
    verifyEmailCode: (params: { code: string }) => ClerkCall;
    sendPhoneCode: () => ClerkCall;
    verifyPhoneCode: (params: { code: string }) => ClerkCall;
    verifyTOTP: (params: { code: string }) => ClerkCall;
    verifyBackupCode: (params: { code: string }) => ClerkCall;
  };
}

/** Sends (or re-sends) the email or text code; authenticator and backup codes need nothing */
export function sendSignInCode(signIn: SignInCodeApi, step: SignInCodeStep): ClerkCall {
  if (step.stage === "first_factor") {
    if (step.method === "email_code") return signIn.emailCode.sendCode();
    if (step.method === "phone_code") return signIn.phoneCode.sendCode();
  } else {
    if (step.method === "email_code") return signIn.mfa.sendEmailCode();
    if (step.method === "phone_code") return signIn.mfa.sendPhoneCode();
  }
  return Promise.resolve({ error: null });
}

/** Checks the code he typed; afterwards, read the next step with getSignInStep */
export function verifySignInCode(
  signIn: SignInCodeApi,
  step: SignInCodeStep,
  code: string,
): ClerkCall {
  const params = { code: code.replace(/\s/g, "") };
  if (step.stage === "first_factor") {
    return step.method === "phone_code" ?
        signIn.phoneCode.verifyCode(params)
      : signIn.emailCode.verifyCode(params);
  }
  switch (step.method) {
    case "email_code":
      return signIn.mfa.verifyEmailCode(params);
    case "phone_code":
      return signIn.mfa.verifyPhoneCode(params);
    case "totp":
      return signIn.mfa.verifyTOTP(params);
    case "backup_code":
      return signIn.mfa.verifyBackupCode(params);
  }
}
