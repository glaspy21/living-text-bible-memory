// Auth.js settings shared by the proxy and the full server config. No database access here,
// so the proxy stays light.
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isAdminEmail } from "./allowlist";

export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    // Only verified Google accounts on the allowlist may sign in (listener accounts are post-MVP).
    signIn({ account, profile }) {
      return (
        account?.provider === "google" &&
        profile?.email_verified === true &&
        isAdminEmail(profile.email)
      );
    },
    // Proxy gate for /admin/*: anyone not on the allowlist is sent to the sign-in page.
    authorized({ auth }) {
      return isAdminEmail(auth?.user?.email);
    },
  },
} satisfies NextAuthConfig;
