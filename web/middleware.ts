import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

/**
 * Porteiro de rotas. Usa só a config edge-safe (sem banco, sem bcrypt); quem
 * decide os redirects é o callback `authorized` em lib/auth/auth.config.ts.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
