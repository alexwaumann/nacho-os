import { describe, expect, it } from "vitest";

import { addressSimilarity, findBestAddressMatch } from "./address";

const jobs = [
  { id: "elm", address: "1418 Elm St, Austin, TX 78704" },
  { id: "burgan", address: "928 BURGAN ST, WACO, TX 76704" },
  { id: "circle", address: "4509 CIRCLE C DRIVE, BELLMEAD, TX 76705" },
];

describe("addressSimilarity", () => {
  it("scores identical addresses as 1", () => {
    expect(addressSimilarity("928 Burgan St, Waco, TX", "928 BURGAN ST, WACO, TX")).toBe(1);
  });

  it("matches a short street address inside a full one", () => {
    expect(addressSimilarity("928 Burgan St", "928 BURGAN ST, WACO, TX 76704")).toBe(1);
  });

  it("does not use containment when house numbers differ", () => {
    expect(addressSimilarity("930 Burgan St", "928 BURGAN ST, WACO, TX 76704")).toBeLessThan(0.7);
  });

  it("does not use containment for a city alone", () => {
    expect(addressSimilarity("Waco TX", "928 BURGAN ST, WACO, TX 76704")).toBeLessThan(0.7);
  });
});

describe("findBestAddressMatch", () => {
  it("finds the job from a check memo street address", () => {
    expect(findBestAddressMatch("928 Burgan St", jobs)?.id).toBe("burgan");
  });

  it("returns null when nothing is close", () => {
    expect(findBestAddressMatch("77 Sunset Blvd, Los Angeles", jobs)).toBeNull();
  });
});
