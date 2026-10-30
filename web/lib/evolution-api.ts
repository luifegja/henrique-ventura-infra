import "server-only";
import {
  bridgeEnabled,
  bridgePayload,
  isDelivered,
  parseConnect,
  parseConnectionState,
  parseInstance,
  parseMessageStatus,
  parseSendResult,
  type ConnectResult,
  type EvoState,
  type InstanceInfo,
} from "@/lib/evolution-parse";

/**
 * Cliente HTTP INTERNO da Evolution API (rede docker, http://evolution:8080), adaptado do
 * CliniTrack 2.0. Diferença que importa: aqui a chave é a DA INSTÂNCIA
 * (HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY), não a global. Ela só abre a instância
 * `henriqueventura`; em qualquer outra a Evolution responde 401 (conferido em 30/10/2026).
 * O nome da instância é fixo e nunca vem do navegador.
 *
 * O que nunca sai daqui: o token do Chatwoot que o `chatwoot/find` devolve.
 */

export const INSTANCE = "henriqueventura";
const BASE = (process.env.EVOLUTION_INTERNAL_URL || "").replace(/\/+$/, "");
const KEY = process.env.HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY || "";

export const hasEvolutionApi = Boolean(BASE && KEY);

export class EvolutionApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EvolutionApiError";
    this.status = status;
  }
}

type Json = Record<string, unknown>;

async function call(method: "GET" | "POST" | "DELETE", path: string, body?: Json, timeoutMs = 10_000): Promise<unknown> {
  if (!hasEvolutionApi) throw new EvolutionApiError(0, "EVOLUTION_INTERNAL_URL/HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY ausentes neste ambiente.");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    // O corpo de erro pode ecoar o pedido (com token): corta curto.
    throw new EvolutionApiError(res.status, `Evolution respondeu ${res.status} em ${path.split("?")[0]}: ${text.slice(0, 160)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new EvolutionApiError(res.status, `Evolution devolveu corpo ilegível em ${path}: ${text.slice(0, 120)}`);
  }
}

const I = encodeURIComponent(INSTANCE);

/** Estado, número e perfil como a Evolution os GRAVOU (atrasa no reinício 515; ver liveState). */
export async function fetchInstance(): Promise<InstanceInfo | null> {
  return parseInstance(await call("GET", `/instance/fetchInstances?instanceName=${I}`));
}

/**
 * Estado VIVO da sessão. No reinício 515 logo depois de ler o QR, o fetchInstances ainda diz
 * `connecting` enquanto a sessão já está `close` — e `connect` em `close` abre um segundo
 * socket (CliniTrack, 30/10: duas sessões se derrubando em laço com 440).
 */
export async function liveState(): Promise<EvoState> {
  return parseConnectionState(await call("GET", `/instance/connectionState/${I}`));
}

/** QR corrente. Fechada → abre o socket e devolve o primeiro QR; `connecting` → o QR que já existe. */
export async function connect(): Promise<ConnectResult> {
  return parseConnect(await call("GET", `/instance/connect/${I}`, undefined, 20_000));
}

/** Encerra a sessão ou o ciclo de QR. Instância já fechada responde 4xx: não é erro. */
export async function logout(): Promise<void> {
  try {
    await call("DELETE", `/instance/logout/${I}`);
  } catch (err) {
    if (err instanceof EvolutionApiError && err.status >= 400 && err.status < 500 && err.status !== 401) return;
    throw err;
  }
}

async function chatwootFind(): Promise<Json | null> {
  try {
    const j = await call("GET", `/chatwoot/find/${I}`);
    return j && typeof j === "object" && !Array.isArray(j) && Object.keys(j as Json).length ? (j as Json) : null;
  } catch (err) {
    if (err instanceof EvolutionApiError && err.status === 404) return null;
    throw err;
  }
}

/** "none": a integração com o Chatwoot nunca foi configurada (instância recém-criada). */
export async function bridgeStatus(): Promise<"on" | "off" | "none"> {
  const found = await chatwootFind();
  if (!found || typeof found.accountId !== "string" || !found.accountId) return "none";
  return bridgeEnabled(found) ? "on" : "off";
}

/**
 * Liga/desliga a integração mantendo o resto da configuração. Regra do runbook 01: nunca
 * parear com ela ligada. `changed=false` quando já estava como pedido ou não existe.
 */
export async function setBridgeEnabled(enabled: boolean): Promise<{ changed: boolean; hadBridge: boolean }> {
  const found = await chatwootFind();
  if (!found || typeof found.accountId !== "string" || !found.accountId) return { changed: false, hadBridge: false };
  if (bridgeEnabled(found) === enabled) return { changed: false, hadBridge: true };
  await call("POST", `/chatwoot/set/${I}`, bridgePayload(found, enabled), 30_000);
  return { changed: true, hadBridge: true };
}

/**
 * Primeira configuração da integração (mesmos valores do scripts/liga-chatwoot-evolution.sh):
 * a Evolution cria a inbox `henriqueventura` na conta do Henrique com o token do bot.
 */
export async function createBridge(input: { accountId: string; botToken: string }): Promise<void> {
  await call(
    "POST",
    `/chatwoot/set/${I}`,
    {
      enabled: true,
      accountId: input.accountId,
      token: input.botToken,
      url: process.env.CHATWOOT_INTERNAL_URL || "http://chatwoot-web:3000",
      nameInbox: INSTANCE,
      signMsg: false,
      reopenConversation: true,
      conversationPending: false,
      mergeBrazilContacts: true,
      importContacts: false,
      importMessages: false,
      daysLimitImportMessages: 0,
      autoCreate: true,
      organization: "Henrique Ventura",
      logo: "",
    },
    30_000,
  );
}

/**
 * Teste de entrega do runbook 01: uma mensagem para o PRÓPRIO número da sessão (não sai para
 * ninguém) e conferir que deixa PENDING. Só o ack diz se a sessão ficou boa.
 */
export async function deliveryCheck(phone: string): Promise<{ ok: boolean; status: string | null; error?: string }> {
  const number = phone.replace(/\D/g, "");
  let keyId: string | null = null;
  try {
    const j = await call("POST", `/message/sendText/${I}`, { number, text: "Teste de conexão do painel — pode ignorar." }, 30_000);
    const sent = parseSendResult(j);
    keyId = sent.keyId;
    if (!keyId) return { ok: false, status: sent.status, error: "A Evolution aceitou a mensagem, mas não devolveu o id para conferir o ack." };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.message : "falha ao enviar o teste" };
  }
  const deadline = Date.now() + 20_000;
  let last: string | null = "PENDING";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_500));
    try {
      const st = parseMessageStatus(await call("POST", `/chat/findStatusMessage/${I}`, { where: { id: keyId } }), keyId);
      if (st) last = st;
      if (isDelivered(last)) return { ok: true, status: last };
    } catch (err) {
      return { ok: false, status: last, error: `Não consegui conferir o ack: ${err instanceof Error ? err.message : "erro"}` };
    }
  }
  return { ok: false, status: last, error: "A mensagem de teste ficou em PENDING por 20 s: a sessão subiu, mas não entrega." };
}
