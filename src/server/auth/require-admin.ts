import "server-only";
import { notFound } from "next/navigation";

/**
 * Server-side admin gate. Call at the top of every admin layout, page, route handler
 * and server action. Until sign-in exists (M5) admin is reachable in local dev only;
 * any production build answers 404.
 */
export async function requireAdmin(): Promise<void> {
  if (process.env.NODE_ENV === "production") notFound();
}
