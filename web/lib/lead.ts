import { z } from "zod";

/**
 * Lead novo pelo painel: o mesmo schema valida o formulário (navegador) e a action (servidor).
 * O lead É um contato do Chatwoot — não existe cópia no painel —, então "espelhado" é de graça.
 */

/**
 * Telefone brasileiro em E.164, que é o que o Chatwoot aceita em `phone_number` e o que a
 * Evolution usa para casar o contato quando o lead mandar mensagem.
 *   (13) 99197-2240 → +5513991972240   ·   5513991972240 → +5513991972240
 *   +1 415 555 0100 → +14155550100 (com "+", qualquer país)
 */
export function normalizaTelefone(input: string): { ok: true; e164: string } | { ok: false; error: string } {
  const bruto = input.trim();
  const d = bruto.replace(/\D/g, "");
  if (!d) return { ok: false, error: "Informe o WhatsApp." };
  if (bruto.startsWith("+")) {
    if (d.length < 8 || d.length > 15) return { ok: false, error: "Número internacional inválido." };
    return { ok: true, e164: `+${d}` };
  }
  let n = d.replace(/^0+/, "");
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (!n.startsWith("55") || (n.length !== 12 && n.length !== 13)) {
    return { ok: false, error: "Use DDD + número, ex.: (13) 99197-2240." };
  }
  const ddd = Number(n.slice(2, 4));
  if (ddd < 11 || ddd > 99) return { ok: false, error: "DDD inválido." };
  if (n.length === 13 && n[4] !== "9") return { ok: false, error: "Celular com 9 dígitos começa com 9." };
  return { ok: true, e164: `+${n}` };
}

export const leadSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  telefone: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const r = normalizaTelefone(v);
      if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error });
    }),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "E-mail inválido."),
  etapa: z.string().trim().min(1).max(80),
  observacao: z.string().trim().max(2000, "Observação muito longa (máx. 2000)."),
});

export type LeadInput = z.input<typeof leadSchema>;
