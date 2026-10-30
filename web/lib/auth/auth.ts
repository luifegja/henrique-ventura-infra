import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { signInChatwoot } from "@/lib/chatwoot-api";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Motivo da recusa, que o formulário de login traduz (components/auth/login-form.tsx). */
class LoginRecusado extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

/** Auth.js no runtime Node: o login É o do Chatwoot (mesmo e-mail e senha). */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const r = await signInChatwoot(parsed.data.email.trim().toLowerCase(), parsed.data.password);
        if (!r.ok) throw new LoginRecusado(r.reason);
        return { id: String(r.userId), email: r.email, name: r.name, cwUserId: r.userId, cwToken: r.token, role: r.role };
      },
    }),
  ],
});
