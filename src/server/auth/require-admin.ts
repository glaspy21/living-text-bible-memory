import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isAdminEmail } from "./allowlist";
import { auth } from "./auth";

/** Reads the session cookie, so the page always renders per request (never prerendered). */
async function sessionEmail(): Promise<string | null | undefined> {
  await connection();
  return (await auth())?.user?.email;
}

/** The signed-in admin's email, or null. Use in route handlers (answer 401/403 yourself). */
export async function getAdminEmail(): Promise<string | null> {
  const email = await sessionEmail();
  return isAdminEmail(email) ? email!.toLowerCase() : null;
}

/**
 * Gate for route handlers: null means "admin, carry on"; otherwise return this response.
 * 401 when signed out, 403 for a signed-in account that isn't on the allowlist.
 */
export async function rejectUnlessAdmin(): Promise<Response | null> {
  const email = await sessionEmail();
  if (!email) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isAdminEmail(email)) return Response.json({ error: "Not allowed." }, { status: 403 });
  return null;
}

/**
 * Server-side admin gate for pages, layouts and server actions. Call it in every one, even
 * behind the proxy: signed-out visitors go to sign-in, signed-in non-admins get a 404.
 */
export async function requireAdmin(callbackPath = "/admin"): Promise<{ email: string }> {
  const email = await sessionEmail();
  if (!email) redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`);
  if (!isAdminEmail(email)) notFound();
  return { email: email.toLowerCase() };
}
