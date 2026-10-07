import { describe, expect, it } from "vitest";

import { getPointerVelocity, getSwipeCommit, getSwipeReveal, isSwipeArmed } from "./swipe";

const WIDTH = 400;

describe("getSwipeCommit", () => {
  it("springs back below 45% of the width", () => {
    expect(getSwipeCommit(100, 0, WIDTH)).toBe(0);
    expect(getSwipeCommit(-179, 200, WIDTH)).toBe(0);
  });

  it("commits past 45% of the width, either way", () => {
    expect(getSwipeCommit(180, 0, WIDTH)).toBe(1);
    expect(getSwipeCommit(-250, 0, WIDTH)).toBe(-1);
  });

  it("commits a fast fling that went far enough the same way", () => {
    expect(getSwipeCommit(90, 900, WIDTH)).toBe(1);
    expect(getSwipeCommit(-90, -900, WIDTH)).toBe(-1);
  });

  it("ignores a short flick, or a fling back the other way", () => {
    expect(getSwipeCommit(30, 2000, WIDTH)).toBe(0);
    expect(getSwipeCommit(120, -900, WIDTH)).toBe(0);
  });

  it("does nothing without movement", () => {
    expect(getSwipeCommit(0, 0, WIDTH)).toBe(0);
  });
});

describe("getSwipeReveal", () => {
  it("shows nothing in the dead zone", () => {
    expect(getSwipeReveal(0, WIDTH)).toBe(0);
    expect(getSwipeReveal(24, WIDTH)).toBe(0);
    expect(getSwipeReveal(-100, WIDTH)).toBe(0);
  });

  it("fades in up to the commit point", () => {
    expect(getSwipeReveal(102, WIDTH)).toBeCloseTo(0.5);
    expect(getSwipeReveal(180, WIDTH)).toBe(1);
    expect(getSwipeReveal(300, WIDTH)).toBe(1);
  });
});

describe("isSwipeArmed", () => {
  it("arms at the commit point either way", () => {
    expect(isSwipeArmed(179, WIDTH)).toBe(false);
    expect(isSwipeArmed(-180, WIDTH)).toBe(true);
  });
});

describe("getPointerVelocity", () => {
  it("measures speed over the last 100ms", () => {
    const samples = [
      { x: 0, time: 0 },
      { x: 0, time: 500 },
      { x: 50, time: 550 },
      { x: 100, time: 600 },
    ];
    expect(getPointerVelocity(samples)).toBe(1000);
  });

  it("uses the previous sample when the last gap is longer than the window", () => {
    expect(
      getPointerVelocity([
        { x: 0, time: 0 },
        { x: -60, time: 200 },
      ]),
    ).toBe(-300);
  });

  it("is zero without movement over time", () => {
    expect(getPointerVelocity([{ x: 10, time: 5 }])).toBe(0);
    expect(getPointerVelocity([])).toBe(0);
  });
});
