import { describe, expect, it } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  it("returns a stored value until it expires", () => {
    let now = 1000;
    const cache = new TtlCache<string>(100, 5, () => now);
    cache.set("a", "one");
    now = 1099;
    expect(cache.get("a")).toBe("one");
    now = 1100;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("drops the oldest entries past the cap", () => {
    const cache = new TtlCache<number>(1000, 2, () => 0);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });
});
