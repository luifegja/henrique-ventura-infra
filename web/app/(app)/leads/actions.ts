"use server";

import { z } from "zod";
import { requireAgent } from "@/lib/session";
import { getListAttributeValues, updateContactAttribute } from "@/lib/chatwoot-api";
import { CADENCIA_KEY } from "@/lib/cadencia";
import { chatwootErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({ contactId: z.number().int().positive(), etapa: z.string().min(1).max(80) });

/**
 * Move o lead de etapa: grava `cadencia_comercial` no contato do Chatwoot com o token de
 * quem arrastou. A etapa tem de existir na definição do atributo (lida na hora).
 */
export async function moveContact(input: { contactId: number; etapa: string }): Promise<ActionResult> {
  const agent = await requireAgent();
  const p = schema.safeParse(input);
  if (!p.success) return fail("Pedido inválido.");
  try {
    const etapas = await getListAttributeValues(agent.token, CADENCIA_KEY);
    if (!etapas.includes(p.data.etapa)) return fail(`"${p.data.etapa}" não é uma etapa da cadência.`);
    await updateContactAttribute(agent.token, p.data.contactId, CADENCIA_KEY, p.data.etapa);
    return ok();
  } catch (e) {
    return fail(chatwootErrorMessage(e, "Não foi possível gravar a etapa no Chatwoot."));
  }
}
