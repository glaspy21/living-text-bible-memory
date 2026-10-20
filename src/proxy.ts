// First line of defence for admin pages; every admin page and action also checks on the server.
import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = { matcher: ["/admin/:path*"] };
