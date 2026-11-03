import { describe, expect, it } from "vitest";

import { RECEIPT_TOTAL_MISSING, toScannedReceipt } from "./scanResult";

const today = new Date(2026, 10, 3);

describe("toScannedReceipt", () => {
  it("keeps what was read, trimmed, with the date as YYYY-MM-DD", () => {
    expect(
      toScannedReceipt(
        {
          storeName: "  Home Depot ",
          storeLocation: " 100 Main St, Waco, TX ",
          summary: " Paint, rollers ",
          total: 84.37,
          date: "10/28/2026",
        },
        today,
      ),
    ).toEqual({
      storeName: "Home Depot",
      storeLocation: "100 Main St, Waco, TX",
      summary: "Paint, rollers",
      total: 84.37,
      date: "2026-10-28",
    });
  });

  it("fills in a missing store and date, and drops empty optional fields", () => {
    expect(toScannedReceipt({ storeName: " ", storeLocation: "", total: 12 }, today)).toEqual({
      storeName: "Unknown store",
      storeLocation: undefined,
      summary: undefined,
      total: 12,
      date: "2026-11-03",
    });
  });

  it("throws a plain message when there's no total", () => {
    expect(() => toScannedReceipt({ storeName: "Lowe's" }, today)).toThrow(RECEIPT_TOTAL_MISSING);
    expect(() => toScannedReceipt({ total: 0 }, today)).toThrow(RECEIPT_TOTAL_MISSING);
    expect(() => toScannedReceipt({}, today)).toThrow(RECEIPT_TOTAL_MISSING);
  });
});
