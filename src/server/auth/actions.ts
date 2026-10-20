"use server";

import { safeCallbackPath } from "./allowlist";
import { signIn, signOut } from "./auth";

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackPath(formData.get("callbackUrl")) });
}

export async function signOutToHome() {
  await signOut({ redirectTo: "/" });
}
