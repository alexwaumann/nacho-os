import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("uses the message of a ConvexError", () => {
    expect(getErrorMessage(new ConvexError("Recording too long"))).toBe("Recording too long");
  });

  it("hides wrapped Convex server errors", () => {
    const error = new Error(
      "[CONVEX A(ai:analyzeReceipt)] [Request ID: 123] Server Error\nUncaught Error: boom",
    );
    expect(getErrorMessage(error, "Try again")).toBe("Try again");
  });

  it("keeps client-side error messages", () => {
    expect(getErrorMessage(new Error("PDF has no pages"))).toBe("PDF has no pages");
  });

  it("falls back for anything else", () => {
    expect(getErrorMessage("nope")).toBe("Something went wrong");
  });
});
