import { describe, expect, it } from "vitest";
import { formatTime } from "./format-time";

describe("formatTime", () => {
  it("shows minutes and two-digit seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(7_400)).toBe("0:07");
    expect(formatTime(65_000)).toBe("1:05");
    expect(formatTime(750_000)).toBe("12:30");
  });

  it("rounds down, and treats junk as zero", () => {
    expect(formatTime(59_999)).toBe("0:59");
    expect(formatTime(-5)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
