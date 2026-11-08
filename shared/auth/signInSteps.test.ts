import { describe, expect, it, vi } from "vitest";

import {
  UNSUPPORTED_STEP_MESSAGE,
  canResendCode,
  describeCodeStep,
  getSignInStep,
  sendSignInCode,
  verifySignInCode,
} from "./signInSteps";
import type { SignInCodeApi, SignInCodeStep } from "./signInSteps";

const email = { strategy: "email_code", safeIdentifier: "d***@gmail.com" };
const phone = { strategy: "phone_code", safeIdentifier: "+1 ***-***-0199" };
const totp = { strategy: "totp" };
const backup = { strategy: "backup_code" };
const password = { strategy: "password" };

describe("getSignInStep", () => {
  it("is done when the sign-in is complete", () => {
    expect(getSignInStep({ status: "complete" })).toEqual({ kind: "done" });
  });

  it("asks for a new-device code by email (client trust)", () => {
    expect(
      getSignInStep({ status: "needs_client_trust", supportedSecondFactors: [phone, email] }),
    ).toEqual({
      kind: "code",
      stage: "client_trust",
      method: "email_code",
      sentTo: email.safeIdentifier,
    });
  });

  it("falls back to a texted code for client trust when there's no email", () => {
    expect(
      getSignInStep({ status: "needs_client_trust", supportedSecondFactors: [phone] }),
    ).toEqual({
      kind: "code",
      stage: "client_trust",
      method: "phone_code",
      sentTo: phone.safeIdentifier,
    });
  });

  it("can't do client trust without an email or phone", () => {
    expect(getSignInStep({ status: "needs_client_trust", supportedSecondFactors: [totp] })).toEqual(
      {
        kind: "unsupported",
        status: "needs_client_trust",
        message: UNSUPPORTED_STEP_MESSAGE,
      },
    );
  });

  it("prefers a texted second factor, then email, authenticator and backup codes", () => {
    const step = (factors: Array<object>) =>
      getSignInStep({ status: "needs_second_factor", supportedSecondFactors: factors as never });
    expect(step([backup, totp, email, phone])).toMatchObject({ method: "phone_code" });
    expect(step([backup, totp, email])).toMatchObject({ method: "email_code" });
    expect(step([backup, totp])).toMatchObject({ method: "totp", sentTo: null });
    expect(step([backup])).toMatchObject({ stage: "second_factor", method: "backup_code" });
  });

  it("uses the primary address when there are several", () => {
    const other = { strategy: "email_code", safeIdentifier: "o***@work.com" };
    const primary = { ...email, primary: true };
    expect(
      getSignInStep({ status: "needs_second_factor", supportedSecondFactors: [other, primary] }),
    ).toMatchObject({ sentTo: primary.safeIdentifier });
  });

  it("offers a first-factor code when Clerk asks for one", () => {
    expect(
      getSignInStep({ status: "needs_first_factor", supportedFirstFactors: [password, email] }),
    ).toEqual({
      kind: "code",
      stage: "first_factor",
      method: "email_code",
      sentTo: email.safeIdentifier,
    });
    expect(
      getSignInStep({ status: "needs_first_factor", supportedFirstFactors: [password, phone] }),
    ).toMatchObject({ stage: "first_factor", method: "phone_code" });
  });

  it("can't continue a first factor that only offers the password again", () => {
    expect(
      getSignInStep({ status: "needs_first_factor", supportedFirstFactors: [password] }),
    ).toMatchObject({ kind: "unsupported", status: "needs_first_factor" });
  });

  it("asks for a new password", () => {
    expect(getSignInStep({ status: "needs_new_password" })).toEqual({ kind: "new_password" });
  });

  it("reports the steps the app can't do", () => {
    for (const status of ["needs_identifier", "needs_protect_check", "something_new", null]) {
      expect(getSignInStep({ status })).toEqual({
        kind: "unsupported",
        status,
        message: UNSUPPORTED_STEP_MESSAGE,
      });
    }
  });

  it("tolerates missing factor lists", () => {
    expect(
      getSignInStep({ status: "needs_second_factor", supportedSecondFactors: null }),
    ).toMatchObject({ kind: "unsupported" });
  });
});

const step = (stage: SignInCodeStep["stage"], method: SignInCodeStep["method"], sentTo = null) =>
  ({ kind: "code", stage, method, sentTo }) as SignInCodeStep;

describe("describeCodeStep / canResendCode", () => {
  it("names where the code went", () => {
    expect(
      describeCodeStep({ ...step("client_trust", "email_code"), sentTo: "d***@gmail.com" }),
    ).toBe("Enter the code we sent to d***@gmail.com.");
    expect(describeCodeStep(step("second_factor", "email_code"))).toBe(
      "Enter the code we sent to your email.",
    );
    expect(describeCodeStep({ ...step("second_factor", "phone_code"), sentTo: "+1 ***0199" })).toBe(
      "Enter the code we texted to +1 ***0199.",
    );
    expect(describeCodeStep(step("second_factor", "totp"))).toMatch(/authenticator app/);
    expect(describeCodeStep(step("second_factor", "backup_code"))).toMatch(/backup codes/);
  });

  it("only resends email and text codes", () => {
    expect(canResendCode(step("client_trust", "email_code"))).toBe(true);
    expect(canResendCode(step("second_factor", "phone_code"))).toBe(true);
    expect(canResendCode(step("second_factor", "totp"))).toBe(false);
    expect(canResendCode(step("second_factor", "backup_code"))).toBe(false);
  });
});

function fakeSignIn() {
  const ok = () => vi.fn((_params?: { code: string }) => Promise.resolve({ error: null }));
  return {
    emailCode: { sendCode: ok(), verifyCode: ok() },
    phoneCode: { sendCode: ok(), verifyCode: ok() },
    mfa: {
      sendEmailCode: ok(),
      verifyEmailCode: ok(),
      sendPhoneCode: ok(),
      verifyPhoneCode: ok(),
      verifyTOTP: ok(),
      verifyBackupCode: ok(),
    },
  } satisfies SignInCodeApi;
}

describe("sendSignInCode", () => {
  it("sends first-factor codes through emailCode / phoneCode", async () => {
    const signIn = fakeSignIn();
    await sendSignInCode(signIn, step("first_factor", "email_code"));
    await sendSignInCode(signIn, step("first_factor", "phone_code"));
    expect(signIn.emailCode.sendCode).toHaveBeenCalledOnce();
    expect(signIn.phoneCode.sendCode).toHaveBeenCalledOnce();
    expect(signIn.mfa.sendEmailCode).not.toHaveBeenCalled();
  });

  it("sends second-factor and client-trust codes through mfa", async () => {
    const signIn = fakeSignIn();
    await sendSignInCode(signIn, step("client_trust", "email_code"));
    await sendSignInCode(signIn, step("second_factor", "email_code"));
    await sendSignInCode(signIn, step("client_trust", "phone_code"));
    expect(signIn.mfa.sendEmailCode).toHaveBeenCalledTimes(2);
    expect(signIn.mfa.sendPhoneCode).toHaveBeenCalledOnce();
    expect(signIn.emailCode.sendCode).not.toHaveBeenCalled();
  });

  it("sends nothing for authenticator and backup codes", async () => {
    const signIn = fakeSignIn();
    expect(await sendSignInCode(signIn, step("second_factor", "totp"))).toEqual({ error: null });
    expect(await sendSignInCode(signIn, step("second_factor", "backup_code"))).toEqual({
      error: null,
    });
    const calls = [
      ...Object.values(signIn.mfa),
      ...Object.values(signIn.emailCode),
      ...Object.values(signIn.phoneCode),
    ];
    for (const call of calls) expect(call).not.toHaveBeenCalled();
  });

  it("passes Clerk's error through", async () => {
    const signIn = fakeSignIn();
    const error = { code: "too_many_requests" };
    signIn.mfa.sendEmailCode.mockResolvedValueOnce({ error } as never);
    expect(await sendSignInCode(signIn, step("client_trust", "email_code"))).toEqual({ error });
  });
});

describe("verifySignInCode", () => {
  it("checks each kind of code with the matching Clerk call, without spaces", async () => {
    const signIn = fakeSignIn();
    await verifySignInCode(signIn, step("first_factor", "email_code"), "123 456");
    await verifySignInCode(signIn, step("first_factor", "phone_code"), "123456");
    await verifySignInCode(signIn, step("client_trust", "email_code"), "111111");
    await verifySignInCode(signIn, step("second_factor", "phone_code"), "222222");
    await verifySignInCode(signIn, step("second_factor", "totp"), "333333");
    await verifySignInCode(signIn, step("second_factor", "backup_code"), " abcd1234 ");
    expect(signIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: "123456" });
    expect(signIn.phoneCode.verifyCode).toHaveBeenCalledWith({ code: "123456" });
    expect(signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: "111111" });
    expect(signIn.mfa.verifyPhoneCode).toHaveBeenCalledWith({ code: "222222" });
    expect(signIn.mfa.verifyTOTP).toHaveBeenCalledWith({ code: "333333" });
    expect(signIn.mfa.verifyBackupCode).toHaveBeenCalledWith({ code: "abcd1234" });
  });

  it("passes a wrong-code error through", async () => {
    const signIn = fakeSignIn();
    const error = { code: "form_code_incorrect" };
    signIn.mfa.verifyEmailCode.mockResolvedValueOnce({ error } as never);
    expect(await verifySignInCode(signIn, step("client_trust", "email_code"), "000000")).toEqual({
      error,
    });
  });
});
