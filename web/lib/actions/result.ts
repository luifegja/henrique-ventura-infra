import type { z } from "zod";

/**
 * Resultado padrão de toda Server Action de escrita. Nunca lança para o
 * cliente: o formulário decide entre erro geral e erros por campo.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function failValidation(
  err: z.ZodError,
  message = "Verifique os campos destacados.",
): ActionResult<never> {
  return {
    ok: false,
    error: message,
    fieldErrors: err.flatten().fieldErrors as Record<string, string[]>,
  };
}

/** Mensagem segura para um erro do Chatwoot (não vaza corpo de resposta ao usuário). */
export function chatwootErrorMessage(err: unknown, fallback: string): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 401) return "O Chatwoot recusou o seu acesso. Saia e entre de novo.";
  if (status === 403) return "O seu usuário do Chatwoot não tem permissão para isso.";
  if (status === 404) return "Não encontrado no Chatwoot (talvez tenha sido apagado).";
  if (status === 0) return "O painel não está configurado para falar com o Chatwoot.";
  return fallback;
}
