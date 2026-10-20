import { describe, expect, it } from "vitest";
import { availableTranslations, createProvider, esvEnabled } from "./index";

describe("the ESV flag", () => {
  it("is off without the flag, even when a key exists", () => {
    expect(esvEnabled({ ESV_API_KEY: "k" })).toBe(false);
    expect(esvEnabled({ ESV_ENABLED: "true" })).toBe(false);
    expect(esvEnabled({ ESV_ENABLED: "true", ESV_API_KEY: "  " })).toBe(false);
    expect(esvEnabled({ ESV_ENABLED: "yes", ESV_API_KEY: "k" })).toBe(false);
  });

  it("is on only with the flag and a key", () => {
    expect(esvEnabled({ ESV_ENABLED: "true", ESV_API_KEY: "k" })).toBe(true);
  });
});

describe("available translations", () => {
  it("always offers WEB and adds ESV only when enabled", () => {
    expect(availableTranslations({})).toEqual(["WEB"]);
    expect(availableTranslations({ ESV_ENABLED: "true", ESV_API_KEY: "k" })).toEqual([
      "WEB",
      "ESV",
    ]);
  });

  it("will not build an ESV provider while it is off", () => {
    expect(createProvider("WEB", {}).translation).toBe("WEB");
    expect(() => createProvider("ESV", { ESV_API_KEY: "k" })).toThrow();
    expect(createProvider("ESV", { ESV_ENABLED: "true", ESV_API_KEY: "k" }).translation).toBe(
      "ESV",
    );
  });
});
