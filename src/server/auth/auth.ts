import NextAuth from "next-auth";
import { db } from "@/server/db/client";
import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    // Keep a User row for each admin so recordings and timing versions can name their author.
    async signIn({ user }) {
      if (!user.email) return;
      const email = user.email.toLowerCase();
      await db.user.upsert({
        where: { email },
        update: { name: user.name ?? undefined, role: "ADMIN" },
        create: { email, name: user.name ?? null, role: "ADMIN" },
      });
    },
  },
});
