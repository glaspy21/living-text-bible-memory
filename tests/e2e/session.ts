import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { E2E_AUTH_SECRET } from "../../playwright.config";

const COOKIE = "authjs.session-token";

/** Sign the browser in as `email` by setting a session cookie signed with the test secret. */
export async function signInAs(context: BrowserContext, email: string) {
  const value = await encode({
    token: { email, name: "Test", sub: email },
    secret: E2E_AUTH_SECRET,
    salt: COOKIE,
  });
  await context.addCookies([
    { name: COOKIE, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}
