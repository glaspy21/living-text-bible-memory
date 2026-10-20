import { describe, expect, it } from "vitest";
import { titleCase } from "./title-case";

describe("titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("gospel choir")).toBe("Gospel Choir");
  });

  it("lowercases the rest of each word", () => {
    expect(titleCase("SOUTHERN gospel")).toBe("Southern Gospel");
  });

  it("collapses extra spaces and trims", () => {
    expect(titleCase("  folk    rock ")).toBe("Folk Rock");
  });

  it("returns an empty string for blank input", () => {
    expect(titleCase("   ")).toBe("");
  });
});
