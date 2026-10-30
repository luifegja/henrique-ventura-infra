import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";

/**
 * Quem está logado, com o token do Chatwoot dessa pessoa. O token vive só no JWT cifrado
 * do cookie (Auth.js) e é lido AQUI, no servidor: o callback `session` não o expõe, então
 * ele nunca chega ao navegador por /api/auth/session.
 *
 * Atrás do Caddy o cookie é o `__Secure-authjs.session-token`; no teste local por
 * http://127.0.0.1:3600, o `authjs.session-token`. Tentamos os dois.
 */
export type Agent = {
  id: number;
  name: string;
  email: string;
  role: "administrator" | "agent";
  token: string;
};

export async function currentAgent(): Promise<Agent | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const req = { headers: Object.fromEntries((await headers()).entries()) };
  for (const secureCookie of [true, false]) {
    const t = (await getToken({ req, secret, secureCookie })) as Record<string, unknown> | null;
    if (t && typeof t.cwToken === "string" && t.cwToken) {
      return {
        id: Number(t.cwUserId) || 0,
        name: String(t.name ?? t.email ?? "Atendente"),
        email: String(t.email ?? ""),
        role: t.role === "administrator" ? "administrator" : "agent",
        token: t.cwToken,
      };
    }
  }
  return null;
}

export async function requireAgent(): Promise<Agent> {
  const a = await currentAgent();
  if (!a) redirect("/login");
  return a;
}

export async function requireAdmin(): Promise<Agent> {
  const a = await requireAgent();
  if (a.role !== "administrator") redirect("/leads");
  return a;
}
