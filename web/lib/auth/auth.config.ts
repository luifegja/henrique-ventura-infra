import type { NextAuthConfig } from "next-auth";

type AppToken = {
  cwUserId?: number;
  cwToken?: string;
  role?: "administrator" | "agent";
};

/**
 * Config edge-safe, compartilhada pelo middleware. O provider Credentials (login pelo
 * Chatwoot) entra em auth.ts. O JWT guarda o token do Chatwoot da pessoa; a sessão que
 * vai ao navegador NÃO (ver lib/session.ts, que lê o token no servidor).
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLogin = nextUrl.pathname === "/login" || nextUrl.pathname.startsWith("/login/");
      if (isLogin) return isLoggedIn ? Response.redirect(new URL("/leads", nextUrl)) : true;
      return isLoggedIn;
    },

    jwt({ token, user }) {
      const t = token as AppToken;
      if (user) {
        const u = user as { cwUserId?: number; cwToken?: string; role?: "administrator" | "agent" };
        t.cwUserId = u.cwUserId;
        t.cwToken = u.cwToken;
        t.role = u.role;
      }
      return token;
    },

    session({ session, token }) {
      const t = token as AppToken;
      session.user.id = String(t.cwUserId ?? "");
      session.user.role = t.role ?? "agent";
      return session;
    },
  },
} satisfies NextAuthConfig;
