/**
 * Augmentation do Auth.js v5. O token do Chatwoot (cwToken) fica só no JWT; a sessão
 * visível no navegador leva apenas id, nome, e-mail e papel na conta do Henrique.
 */
declare module "next-auth" {
  interface User {
    id?: string;
    cwUserId?: number;
    cwToken?: string;
    role?: "administrator" | "agent";
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: "administrator" | "agent";
    };
  }
}

export {};
