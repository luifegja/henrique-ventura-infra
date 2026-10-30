"use server";

import { z } from "zod";
import { requireAgent } from "@/lib/session";
import { revalidatePath } from "next/cache";
import {
  addContactNote,
  ChatwootApiError,
  createContact,
  getListAttributeValues,
  searchContacts,
  updateContactAttribute,
} from "@/lib/chatwoot-api";
import { CADENCIA_KEY } from "@/lib/cadencia";
import { leadSchema, normalizaTelefone, type LeadInput } from "@/lib/lead";
import { chatwootErrorMessage, fail, failValidation, ok, type ActionResult } from "@/lib/actions/result";

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

export type LeadCriado = { id: number; notaOk: boolean };
/** Como ActionResult, mais `existente` quando o telefone/e-mail já é de outro lead (a tela oferece o link). */
export type CriarLeadResult =
  | { ok: true; data?: LeadCriado }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; existente?: { id: number; nome: string } };

/**
 * Lead novo = contato novo no Chatwoot (com a etapa em `cadencia_comercial`), criado com o token
 * de quem está logado. Não há cópia no painel: o quadro e o Chatwoot mostram o mesmo contato.
 * A observação vira nota no contato (aba Notas da ficha no Chatwoot).
 */
export async function criarLead(input: LeadInput): Promise<CriarLeadResult> {
  const agent = await requireAgent();
  const p = leadSchema.safeParse(input);
  if (!p.success) return failValidation(p.error);
  const tel = normalizaTelefone(p.data.telefone);
  if (!tel.ok) return fail(tel.error);
  try {
    const etapas = await getListAttributeValues(agent.token, CADENCIA_KEY);
    if (!etapas.includes(p.data.etapa)) return fail(`"${p.data.etapa}" não é uma etapa da cadência.`);

    // Antes de criar: o mesmo WhatsApp já é um lead? (o Chatwoot também recusaria com 422)
    const digitos = tel.e164.replace(/\D/g, "");
    const mesmo = (await searchContacts(agent.token, digitos)).find((c) => (c.phone ?? "").replace(/\D/g, "") === digitos);
    if (mesmo) return { ok: false, error: `Este WhatsApp já é o lead "${mesmo.name ?? mesmo.phone}".`, existente: { id: mesmo.id, nome: mesmo.name ?? mesmo.phone ?? "" } };

    let c;
    try {
      c = await createContact(agent.token, {
        name: p.data.nome,
        phone: tel.e164,
        email: p.data.email || null,
        attrs: { [CADENCIA_KEY]: p.data.etapa },
      });
    } catch (e) {
      if (e instanceof ChatwootApiError && e.status === 422) {
        if (/email/i.test(e.message) && p.data.email) {
          const outro = (await searchContacts(agent.token, p.data.email)).find((x) => (x.email ?? "").toLowerCase() === p.data.email.toLowerCase());
          if (outro) return { ok: false, error: `Este e-mail já é do lead "${outro.name ?? outro.email}".`, existente: { id: outro.id, nome: outro.name ?? "" } };
        }
        return fail("O Chatwoot recusou o contato (telefone ou e-mail já usados na conta?).");
      }
      throw e;
    }
    let nota = false;
    if (p.data.observacao) {
      try {
        await addContactNote(agent.token, c.id, p.data.observacao);
        nota = true;
      } catch {
        /* o lead já existe; a tela avisa que a observação não entrou */
      }
    }
    revalidatePath("/leads");
    return ok({ id: c.id, notaOk: nota || !p.data.observacao });
  } catch (e) {
    return fail(chatwootErrorMessage(e, "Não foi possível criar o lead no Chatwoot."));
  }
}
