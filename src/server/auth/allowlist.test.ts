import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAllowlist, safeCallbackPath } from "./allowlist";

describe("admin allowlist", () => {
  it("parses a comma-separated list, ignoring case and spaces", () => {
    expect(parseAllowlist(" A@x.com, b@y.com ,,")).toEqual(new Set(["a@x.com", "b@y.com"]));
  });

  it("admits listed emails in any case", () => {
    expect(isAdminEmail("Owner@Example.com", "owner@example.com")).toBe(true);
  });

  it("rejects unlisted, empty and missing emails", () => {
    expect(isAdminEmail("someone@else.com", "owner@example.com")).toBe(false);
    expect(isAdminEmail("", "owner@example.com")).toBe(false);
    expect(isAdminEmail(null, "owner@example.com")).toBe(false);
  });

  it("treats an empty or missing allowlist as nobody", () => {
    expect(isAdminEmail("owner@example.com", "")).toBe(false);
    expect(isAdminEmail("owner@example.com", undefined)).toBe(false);
  });
});

describe("safeCallbackPath", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackPath("/admin/upload")).toBe("/admin/upload");
  });

  it("refuses other sites and odd values", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "admin", 42, null]) {
      expect(safeCallbackPath(bad)).toBe("/admin");
    }
  });
});
