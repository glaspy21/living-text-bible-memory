import { beforeEach, describe, expect, it, vi } from "vitest";
import { authConfig } from "./config";

type SignInArgs = Parameters<typeof authConfig.callbacks.signIn>[0];
type AuthorizedArgs = Parameters<typeof authConfig.callbacks.authorized>[0];

const signIn = (provider: string, profile: { email?: string; email_verified?: boolean }) =>
  authConfig.callbacks.signIn({ account: { provider }, profile } as unknown as SignInArgs);

const authorized = (email?: string) =>
  authConfig.callbacks.authorized({
    auth: email ? { user: { email } } : null,
  } as unknown as AuthorizedArgs);

beforeEach(() => vi.stubEnv("ADMIN_EMAILS", "owner@example.com"));

describe("sign-in rules", () => {
  it("accepts a verified Google account on the allowlist", () => {
    expect(signIn("google", { email: "owner@example.com", email_verified: true })).toBe(true);
  });

  it("rejects unverified, unlisted or non-Google sign-ins", () => {
    expect(signIn("google", { email: "owner@example.com", email_verified: false })).toBe(false);
    expect(signIn("google", { email: "someone@else.com", email_verified: true })).toBe(false);
    expect(signIn("github", { email: "owner@example.com", email_verified: true })).toBe(false);
  });
});

describe("proxy gate", () => {
  it("lets only allowlisted sessions into /admin", () => {
    expect(authorized("owner@example.com")).toBe(true);
    expect(authorized("someone@else.com")).toBe(false);
    expect(authorized()).toBe(false);
  });
});
