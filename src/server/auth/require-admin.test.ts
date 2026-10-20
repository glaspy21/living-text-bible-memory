import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as { user?: { email?: string } } | null }));

vi.mock("./auth", () => ({ auth: async () => session.current }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { getAdminEmail, rejectUnlessAdmin, requireAdmin } = await import("./require-admin");

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
  session.current = null;
});

describe("requireAdmin", () => {
  it("sends signed-out visitors to sign-in, remembering where they were going", async () => {
    await expect(requireAdmin("/admin/upload")).rejects.toThrow(
      "REDIRECT /sign-in?callbackUrl=%2Fadmin%2Fupload",
    );
  });

  it("answers 404 to a signed-in account that isn't on the allowlist", async () => {
    session.current = { user: { email: "someone@else.com" } };
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("lets an allowlisted admin through", async () => {
    session.current = { user: { email: "Owner@Example.com" } };
    await expect(requireAdmin()).resolves.toEqual({ email: "owner@example.com" });
  });
});

describe("getAdminEmail", () => {
  it("is null for visitors and non-admins", async () => {
    expect(await getAdminEmail()).toBeNull();
    session.current = { user: { email: "someone@else.com" } };
    expect(await getAdminEmail()).toBeNull();
  });

  it("returns the admin's email", async () => {
    session.current = { user: { email: "owner@example.com" } };
    expect(await getAdminEmail()).toBe("owner@example.com");
  });
});

describe("rejectUnlessAdmin (route handlers)", () => {
  it("answers 401 when signed out", async () => {
    expect((await rejectUnlessAdmin())?.status).toBe(401);
  });

  it("answers 403 for a signed-in account that isn't on the allowlist", async () => {
    session.current = { user: { email: "someone@else.com" } };
    expect((await rejectUnlessAdmin())?.status).toBe(403);
  });

  it("lets an admin through", async () => {
    session.current = { user: { email: "owner@example.com" } };
    expect(await rejectUnlessAdmin()).toBeNull();
  });
});
