/**
 * Leitura das respostas da Evolution API (2.4.0-rc2), sem rede: funções puras
 * usadas por lib/evolution-api.ts e testadas em tests/evolution-parse.test.ts.
 *
 * Os formatos foram conferidos com curl na rede interna em 16/09
 * (`/instance/fetchInstances`, `/instance/connectionState`, `/chatwoot/find`);
 * os demais seguem a documentação da 2.x. Toda leitura tolera campo ausente:
 * a tela prefere "não sei" a quebrar no meio de um pareamento.
 */

export type EvoState = "open" | "connecting" | "close";

/** A Evolution só conhece três estados; qualquer outra coisa é "sem sessão". */
export function parseState(v: unknown): EvoState {
  const s = String(v ?? "").toLowerCase();
  if (s === "open" || s === "connecting") return s;
  return "close";
}

export type InstanceInfo = {
  name: string;
  state: EvoState;
  /** E.164 com "+", derivado do ownerJid (5513996690572@s.whatsapp.net). */
  phone: string | null;
  profileName: string | null;
  disconnectCode: number | null;
  disconnectAt: string | null;
};

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function phoneFromJid(jid: unknown): string | null {
  if (typeof jid !== "string") return null;
  const digits = jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? `+${digits}` : null;
}

/**
 * Uma instância de `GET /instance/fetchInstances?instanceName=X` (a resposta é
 * um array, mesmo filtrada) ou o objeto solto. `null` quando não veio nada.
 */
export function parseInstance(j: unknown): InstanceInfo | null {
  const item = Array.isArray(j) ? j.find(isObj) : isObj(j) ? j : null;
  if (!item) return null;
  const name = typeof item.name === "string" ? item.name : typeof item.instanceName === "string" ? item.instanceName : "";
  if (!name) return null;
  const code = Number(item.disconnectionReasonCode);
  return {
    name,
    state: parseState(item.connectionStatus ?? item.state),
    phone: phoneFromJid(item.ownerJid) ?? (typeof item.number === "string" ? phoneFromJid(`${item.number}@x`) : null),
    profileName: typeof item.profileName === "string" && item.profileName.trim() ? item.profileName.trim() : null,
    disconnectCode: Number.isFinite(code) && code > 0 ? code : null,
    disconnectAt: typeof item.disconnectionAt === "string" ? item.disconnectionAt : null,
  };
}

/** `GET /instance/connectionState/X` → `{ instance: { instanceName, state } }`. */
export function parseConnectionState(j: unknown): EvoState {
  if (!isObj(j)) return "close";
  const inner = isObj(j.instance) ? j.instance : j;
  return parseState(inner.state);
}

export type ConnectResult =
  /** Sessão ainda não existe: a Evolution devolveu o QR corrente. */
  | { kind: "qr"; base64: string; code: string | null; count: number }
  /** Sessão já existe (ou está subindo): não há QR. */
  | { kind: "state"; state: EvoState };

/**
 * `GET /instance/connect/X`: com a sessão fechada ou em conexão devolve o QR
 * corrente (`{ base64, code, count }` — `base64` já é um data URL PNG); com a
 * sessão aberta devolve `{ instance: { state: 'open' } }`. Chamar de novo em
 * `connecting` NÃO gera QR novo: a Evolution devolve o que já tem, e é o
 * Baileys que regenera a cada ~40 s (o `count` sobe).
 */
export function parseConnect(j: unknown): ConnectResult {
  if (!isObj(j)) return { kind: "state", state: "close" };
  const b64 = typeof j.base64 === "string" ? j.base64 : "";
  if (b64) {
    const count = Number(j.count);
    return {
      kind: "qr",
      base64: b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`,
      code: typeof j.code === "string" && j.code ? j.code : null,
      count: Number.isFinite(count) && count > 0 ? count : 1,
    };
  }
  return { kind: "state", state: parseConnectionState(j) };
}

/** `POST /message/sendText/X` → `{ key: { id, remoteJid }, status }`. */
export function parseSendResult(j: unknown): { keyId: string | null; remoteJid: string | null; status: string | null } {
  if (!isObj(j)) return { keyId: null, remoteJid: null, status: null };
  const key = isObj(j.key) ? j.key : {};
  return {
    keyId: typeof key.id === "string" ? key.id : null,
    remoteJid: typeof key.remoteJid === "string" ? key.remoteJid : null,
    status: typeof j.status === "string" ? j.status : null,
  };
}

/**
 * `POST /chat/findStatusMessage/X` devolve as atualizações de status
 * (`MessageUpdate`: PENDING → SERVER_ACK → DELIVERY_ACK → READ). Pega o mais
 * avançado para o keyId pedido; `null` quando não há nenhum.
 */
const ACK_ORDER = ["PENDING", "SERVER_ACK", "DELIVERY_ACK", "READ", "PLAYED"];

export function parseMessageStatus(j: unknown, keyId: string): string | null {
  const rows: unknown[] = Array.isArray(j) ? j : isObj(j) && Array.isArray(j.messageUpdate) ? j.messageUpdate : isObj(j) && Array.isArray(j.records) ? j.records : [];
  let best: string | null = null;
  for (const r of rows) {
    if (!isObj(r)) continue;
    const id = typeof r.keyId === "string" ? r.keyId : isObj(r.key) && typeof r.key.id === "string" ? r.key.id : null;
    if (id && id !== keyId) continue;
    const st = typeof r.status === "string" ? r.status.toUpperCase() : null;
    if (!st) continue;
    if (best === null || ACK_ORDER.indexOf(st) > ACK_ORDER.indexOf(best)) best = st;
  }
  return best;
}

/** Entregue = o servidor do WhatsApp aceitou (ou além). PENDING para sempre = sessão ruim. */
export function isDelivered(status: string | null): boolean {
  return status !== null && ACK_ORDER.indexOf(status) >= ACK_ORDER.indexOf("SERVER_ACK");
}

/**
 * Motivo da queda, na língua de quem lê a tela. Os códigos são os do Baileys
 * (`DisconnectReason`); o que se sabe de cada um vem das investigações de
 * 20/08 e 29/08 (docs/decisoes/2026-08-20-queda-de-sessao-evolution.md).
 */
export function disconnectReasonLabel(code: number | null): string {
  switch (code) {
    case null:
      return "a sessão foi encerrada";
    case 401:
      return "o aparelho desvinculou este dispositivo";
    case 403:
      return "o WhatsApp recusou a sessão (dispositivo removido no aparelho ou número restringido)";
    case 408:
      return "a conexão expirou";
    case 411:
      return "o WhatsApp pediu para conectar de novo";
    case 428:
      return "a conexão foi fechada";
    case 440:
      return "o número foi conectado em outro lugar e esta sessão foi substituída";
    case 500:
      return "o WhatsApp devolveu um erro interno";
    case 515:
      return "o WhatsApp pediu um reinício (normal logo após parear)";
    default:
      return `o WhatsApp encerrou a sessão (código ${code})`;
  }
}

/**
 * Campos da configuração Chatwoot da Evolution (`GET /chatwoot/find`) que o
 * `POST /chatwoot/set` aceita de volta. Lista branca de propósito: o `find`
 * devolve também `webhook_url`, ids e datas, que o `set` não conhece; e nulos
 * (organization, logo, signDelimiter) saem para não tropeçar na validação.
 */
const BRIDGE_KEYS = [
  "accountId", "token", "url", "nameInbox", "signMsg", "signDelimiter", "reopenConversation",
  "conversationPending", "mergeBrazilContacts", "importContacts", "importMessages",
  "daysLimitImportMessages", "organization", "logo", "ignoreJids",
] as const;

export function bridgePayload(found: Json, enabled: boolean): Json {
  const out: Json = { enabled, autoCreate: true };
  for (const k of BRIDGE_KEYS) {
    const v = found[k];
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function bridgeEnabled(found: Json | null): boolean {
  return !!found && found.enabled === true;
}
