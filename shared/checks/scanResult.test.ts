import { describe, expect, it } from "vitest";

import { CHECK_AMOUNT_MISSING, rankJobsForCheck, toScannedCheck } from "./scanResult";

const today = new Date(2026, 10, 3);

describe("toScannedCheck", () => {
  it("keeps what was read, trimmed, with the date as YYYY-MM-DD", () => {
    expect(
      toScannedCheck(
        {
          amount: 450,
          payerName: " Jane Smith ",
          date: "11/1/2026",
          detectedAddress: " 928 Burgan St ",
        },
        today,
      ),
    ).toEqual({
      amount: 450,
      payerName: "Jane Smith",
      date: "2026-11-01",
      detectedAddress: "928 Burgan St",
    });
  });

  it("drops empty fields and falls back to today", () => {
    expect(toScannedCheck({ amount: 75, payerName: "", detectedAddress: "  " }, today)).toEqual({
      amount: 75,
      payerName: undefined,
      date: "2026-11-03",
      detectedAddress: undefined,
    });
  });

  it("throws a plain message when there's no amount", () => {
    expect(() => toScannedCheck({ payerName: "Jane" }, today)).toThrow(CHECK_AMOUNT_MISSING);
    expect(() => toScannedCheck({ amount: 0 }, today)).toThrow(CHECK_AMOUNT_MISSING);
  });
});

describe("rankJobsForCheck", () => {
  const jobs = [
    { _id: "a", address: "12 Oak Ave, Waco, TX 76701" },
    { _id: "b", address: "928 Burgan St, Waco, TX 76704" },
    { _id: "c", address: "5 Elm Dr, Waco, TX 76705" },
  ];

  it("puts the memo's best match first and keeps the rest in order", () => {
    const { recommendedJob, jobs: ranked } = rankJobsForCheck("928 Burgan St", jobs);
    expect(recommendedJob?._id).toBe("b");
    expect(ranked.map((job) => job._id)).toEqual(["b", "a", "c"]);
  });

  it("leaves the order alone when nothing matches or there's no memo address", () => {
    expect(rankJobsForCheck("77 Nowhere Rd", jobs)).toEqual({ recommendedJob: null, jobs });
    expect(rankJobsForCheck(undefined, jobs)).toEqual({ recommendedJob: null, jobs });
  });
});
