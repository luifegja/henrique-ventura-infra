"use server";

import { z } from "zod";
import { requireAgent } from "@/lib/session";
import { listMessages, sendMessage, toggleConversationStatus, type Message } from "@/lib/chatwoot-api";
import { chatwootErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/result";

/** Limite do WhatsApp para uma mensagem de texto. */
const RESPOSTA_MAX = 4096;

const id = z.number().int().positive();

/** Polling da conversa aberta: só o que chegou depois da última mensagem conhecida. */
export async function novasMensagens(input: { conversationId: number; afterId: number | null }): Promise<ActionResult<Message[]>> {
  const agent = await requireAgent();
  if (!id.safeParse(input.conversationId).success) return fail("Conversa inválida.");
  try {
    return ok(await listMessages(agent.token, input.conversationId, input.afterId ?? undefined));
  } catch (e) {
    return fail(chatwootErrorMessage(e, "Não foi possível atualizar a conversa."));
  }
}

/** Responde pelo Chatwoot com o token de quem está logado: sai no WhatsApp com o nome dele. */
export async function responder(input: { conversationId: number; text: string }): Promise<ActionResult<Message>> {
  const agent = await requireAgent();
  const p = z.object({ conversationId: id, text: z.string().trim().min(1, "Escreva a mensagem.").max(RESPOSTA_MAX) }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Mensagem inválida.");
  try {
    return ok(await sendMessage(agent.token, p.data.conversationId, p.data.text));
  } catch (e) {
    return fail(chatwootErrorMessage(e, "O Chatwoot não aceitou a mensagem. Nada foi enviado."));
  }
}

export async function mudarStatus(input: { conversationId: number; status: "open" | "resolved" }): Promise<ActionResult> {
  const agent = await requireAgent();
  const p = z.object({ conversationId: id, status: z.enum(["open", "resolved"]) }).safeParse(input);
  if (!p.success) return fail("Pedido inválido.");
  try {
    await toggleConversationStatus(agent.token, p.data.conversationId, p.data.status);
    return ok();
  } catch (e) {
    return fail(chatwootErrorMessage(e, "Não foi possível mudar o status da conversa."));
  }
}
