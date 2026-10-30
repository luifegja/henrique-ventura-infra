"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { ok, fail, chatwootErrorMessage, type ActionResult } from "@/lib/actions/result";
import { connect, createBridge, deliveryCheck, fetchInstance, hasEvolutionApi, liveState, logout, setBridgeEnabled, bridgeStatus, INSTANCE } from "@/lib/evolution-api";
import { addInboxMembers, findInboxByName, listAgents, ACCOUNT_ID } from "@/lib/chatwoot-api";
import { mem, getView, type WhatsappView } from "@/lib/whatsapp";
import { gate, pairingActive, stabilizeLeft, PAIRING_TIMEOUT_MS, RESTRICT_MS } from "@/lib/whatsapp-gate";
import { formatDateTime } from "@/lib/utils";

/**
 * Tela WhatsApp (/whatsapp), só para administradores — o runbook 01 com os freios embutidos.
 * Base: app/(app)/whatsapp/actions.ts do CliniTrack 2.0 (sem banco: estado em lib/whatsapp.ts)
 * + a espera de 5 min do GymTrack antes de ligar o Chatwoot.
 *
 *   Conectar    → freios → desliga a integração com o Chatwoot → GET /instance/connect (QR)
 *   polling     → refreshPairing: estado VIVO; open → teste de entrega e começa a espera
 *   espera      → finishStabilization: 5 min em `open` → liga o Chatwoot (cria na 1ª vez) e
 *                 põe bot e administradores na inbox
 *   Cancelar    → logout; 3 min sem leitura → logout sozinho (temporizador no servidor)
 *   Desconectar → logout
 */

const NO_API = "O painel está sem acesso à Evolution neste ambiente (EVOLUTION_INTERNAL_URL / HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY).";

function gateMessage(reason: string, until: number | null): string {
  const quando = until ? formatDateTime(new Date(until)) : null;
  switch (reason) {
    case "restricted":
      return `O WhatsApp restringiu a conta. Conectar libera ${quando ? `às ${quando}` : "em algumas horas"}; insistir antes só estende a punição.`;
    case "pairing_in_progress":
      return "Outra pessoa está pareando este número agora. Espere ela terminar (ou o pareamento expirar, em 3 minutos).";
    case "daily_limit":
      return `Já foram 3 tentativas nas últimas 24 horas. Libera ${quando ? `às ${quando}` : "amanhã"}.`;
    default:
      return "Conectar não está disponível agora.";
  }
}

/**
 * Freio sem banco nem vigia: se ninguém ler o QR no prazo, encerra o ciclo mesmo com a aba
 * fechada. Cada QR gerado conta contra a conta no WhatsApp.
 */
function agendaFreio(startedAt: number) {
  setTimeout(async () => {
    if (mem.pairing?.startedAt !== startedAt) return;
    try {
      if ((await liveState()) !== "open") await logout();
    } catch {
      /* melhor esforço; a próxima abertura da tela mostra o estado real */
    }
    if (mem.pairing?.startedAt === startedAt) mem.pairing = null;
  }, PAIRING_TIMEOUT_MS + 5_000).unref?.();
}

export type QrView = { base64: string; count: number };
export type PairingView = { state: "open" | "connecting" | "close"; qr: QrView | null; expired?: boolean };

export async function getWhatsappView(): Promise<ActionResult<WhatsappView>> {
  const a = await requireAdmin();
  try {
    return ok(await getView(a.id));
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Não consegui ler o estado na Evolution.");
  }
}

export async function startPairing(): Promise<ActionResult<PairingView>> {
  const a = await requireAdmin();
  if (!hasEvolutionApi) return fail(NO_API);
  const now = Date.now();

  // Antes de tudo, o estado REAL: com a sessão aberta, `connect` abriria um segundo socket e
  // derrubaria a sessão boa. Aberta = não gasta tentativa nem pede QR.
  try {
    if ((await liveState()) === "open") return ok({ state: "open", qr: null });
  } catch (err) {
    return fail(`Não consegui conferir o estado na Evolution antes de pedir o QR: ${err instanceof Error ? err.message : "erro"}`);
  }

  const gt = gate(mem, now, a.id);
  if (!gt.ok) return fail(gateMessage(gt.reason, gt.until));
  if (!gt.resume) {
    mem.attempts.push(now);
    mem.pairing = { startedAt: now, by: a.id };
    mem.qrLidoEm = null;
    mem.stabilizingSince = null;
    agendaFreio(now);
  }

  try {
    // Regra de ouro do runbook 01: nunca parear com a integração do Chatwoot ligada.
    await setBridgeEnabled(false);
    const res = await connect();
    if (res.kind === "qr") return ok({ state: "connecting", qr: { base64: res.base64, count: res.count } });
    if (res.state === "open") {
      mem.pairing = null;
      mem.stabilizingSince = Date.now();
      return ok({ state: "open", qr: null });
    }
    return ok({ state: res.state, qr: null });
  } catch (err) {
    try {
      if ((await liveState()) !== "open") await logout();
    } catch {
      /* melhor esforço */
    }
    mem.pairing = null;
    return fail(`Não consegui pedir o QR à Evolution: ${err instanceof Error ? err.message : "erro"}`);
  }
}

/** Polling da tela enquanto pareia (2 s). Decide pelo estado VIVO. */
export async function refreshPairing(): Promise<ActionResult<PairingView>> {
  await requireAdmin();
  if (!hasEvolutionApi) return fail(NO_API);
  const now = Date.now();
  try {
    const vivo = await liveState();
    if (vivo === "open") {
      if (mem.pairing) {
        mem.pairing = null;
        mem.stabilizingSince = now;
      }
      return ok({ state: "open", qr: null });
    }
    if (!mem.pairing) return ok({ state: vivo, qr: null });
    if (!pairingActive(mem, now)) {
      await logout();
      mem.pairing = null;
      return ok({ state: "close", qr: null, expired: true });
    }
    const inicio = mem.pairing.startedAt;
    // `close` no meio do pareamento = o reinício 515 depois de ler o QR.
    if (vivo !== "connecting") mem.qrLidoEm = inicio;
    // QR já lido: a Evolution reconecta sozinha. Nunca pedir `connect` aqui (sessão dupla).
    if (mem.qrLidoEm === inicio) return ok({ state: "connecting", qr: null });
    const res = await connect();
    if (res.kind === "qr") return ok({ state: "connecting", qr: { base64: res.base64, count: res.count } });
    return ok({ state: res.state === "open" ? "open" : "connecting", qr: null });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Não consegui conferir o estado.");
  }
}

export async function cancelPairing(): Promise<ActionResult> {
  await requireAdmin();
  if (!hasEvolutionApi) return fail(NO_API);
  try {
    if ((await liveState()) !== "open") await logout();
    mem.pairing = null;
    revalidatePath("/whatsapp");
    return ok();
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Não foi possível cancelar.");
  }
}

/** Teste de entrega para o próprio número da sessão (runbook 01). Informativo. */
export async function runDeliveryCheck(): Promise<ActionResult<{ ok: boolean; status: string | null; error?: string }>> {
  await requireAdmin();
  if (!hasEvolutionApi) return fail(NO_API);
  const phone = (await fetchInstance())?.phone ?? null;
  if (!phone) return fail("A Evolution ainda não informou o número desta sessão; tente de novo em alguns segundos.");
  const r = await deliveryCheck(phone);
  mem.lastDelivery = { at: Date.now(), ok: r.ok, status: r.status, error: r.error ?? null };
  return ok(r);
}

/**
 * Fim da espera: 5 min com a sessão `open` → liga a integração com o Chatwoot (cria na 1ª vez,
 * com o token do bot; a Evolution cria a inbox) e põe bot + administradores na inbox, com o
 * token do administrador logado (POST /inbox_members só acrescenta).
 */
export async function finishStabilization(): Promise<ActionResult<{ done: boolean; leftMs: number; inboxId?: number | null; note?: string }>> {
  const a = await requireAdmin();
  if (!hasEvolutionApi) return fail(NO_API);
  const now = Date.now();
  try {
    if ((await liveState()) !== "open") {
      mem.stabilizingSince = null;
      return fail("A sessão caiu durante a espera. Não insista agora: espere alguns minutos e conecte de novo.");
    }
    if (mem.stabilizingSince === null) mem.stabilizingSince = now;
    const left = stabilizeLeft(mem, now) ?? 0;
    if (left > 0) return ok({ done: false, leftMs: left });

    const bridge = await bridgeStatus();
    if (bridge === "none") {
      const botToken = process.env.CHATWOOT_BOT_TOKEN || "";
      if (!botToken || !ACCOUNT_ID) return fail("Falta CHATWOOT_BOT_TOKEN/CHATWOOT_ACCOUNT_ID no ambiente do painel.");
      await createBridge({ accountId: ACCOUNT_ID, botToken });
    } else if (bridge === "off") {
      await setBridgeEnabled(true);
    }
    mem.stabilizingSince = null;

    // A inbox aparece em alguns segundos; se ainda não, a próxima abertura da tela completa.
    let inboxId: number | null = null;
    for (let i = 0; i < 5 && !inboxId; i++) {
      inboxId = await findInboxByName(a.token, INSTANCE);
      if (!inboxId) await new Promise((r) => setTimeout(r, 2_000));
    }
    if (!inboxId) return ok({ done: true, leftMs: 0, inboxId: null, note: "A integração foi ligada, mas a caixa de entrada ainda não apareceu no Chatwoot. Abra esta tela de novo em um minuto." });
    const agents = await listAgents(a.token);
    const botId = Number(process.env.CHATWOOT_BOT_USER_ID || 0);
    const ids = agents.filter((x) => x.role === "administrator" || x.id === botId).map((x) => x.id);
    await addInboxMembers(a.token, inboxId, ids);
    revalidatePath("/whatsapp");
    return ok({ done: true, leftMs: 0, inboxId });
  } catch (err) {
    return fail(chatwootErrorMessage(err, err instanceof Error ? err.message : "Não consegui ligar o Chatwoot."));
  }
}

export async function disconnectWhatsapp(): Promise<ActionResult> {
  await requireAdmin();
  if (!hasEvolutionApi) return fail(NO_API);
  try {
    await logout();
    mem.stabilizingSince = null;
    revalidatePath("/whatsapp");
    return ok();
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Não foi possível desconectar.");
  }
}

/** O celular mostrou "conta restringida": trava o Conectar por 6 h. */
export async function markRestricted(): Promise<ActionResult> {
  await requireAdmin();
  try {
    if (hasEvolutionApi && (await liveState()) !== "open") await logout();
  } catch {
    /* pode nem estar em ciclo */
  }
  mem.pairing = null;
  mem.restrictedUntil = Date.now() + RESTRICT_MS;
  revalidatePath("/whatsapp");
  return ok();
}
