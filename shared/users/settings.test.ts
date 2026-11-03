import { describe, expect, it } from "vitest";

import { isReadingRepliesAloud, parseThemePreference } from "./settings";

describe("parseThemePreference", () => {
  it("keeps a known choice", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("falls back to system for nothing or anything else", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference("")).toBe("system");
    expect(parseThemePreference("Dark")).toBe("system");
    expect(parseThemePreference(1)).toBe("system");
  });
});

describe("isReadingRepliesAloud", () => {
  it("is on when there are no settings yet", () => {
    expect(isReadingRepliesAloud(undefined)).toBe(true);
    expect(isReadingRepliesAloud(null)).toBe(true);
    expect(isReadingRepliesAloud({})).toBe(true);
  });

  it("follows the setting once it is saved", () => {
    expect(isReadingRepliesAloud({ readRepliesAloud: true })).toBe(true);
    expect(isReadingRepliesAloud({ readRepliesAloud: false })).toBe(false);
  });
});
